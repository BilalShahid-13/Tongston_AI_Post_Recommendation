# Tongston — AI-Assisted Post Creation & Files/Docs (Resubmission)

[![Watch the video](./workflow.mp4)](./workflow.mp4)


This is a patch set on top of the original submission, addressing the gaps
raised in review. It keeps the existing project structure and stack
(Bun + Express + Mongoose + BullMQ + Ollama via LangChain) rather than
reshuffling folders, so the diff stays reviewable.

## Setup

```bash
bun install
cp .env.example .env   # fill in real values — never commit .env itself
bun run index.ts
```

Requires locally: MongoDB (with a Mongo Atlas Search / vector index named
`vector_index` on the `document_chunks` collection if you want semantic
document search), Redis (for BullMQ), and Ollama running the models named
in `.env.example`.

## Architecture

```
index.ts
 ├─ requestId middleware        (every request gets x-request-id, used in logs)
 ├─ /files   → file.controller  → File.model, embeddingQueue
 ├─ /ai      → ai.controller    → post-generation / hashtag / media-recommendation services
 ├─ /search  → search.controller (LangChain agent + retrieval tool over vector store)
 ├─ /sse     → sse.manager      (embedding progress push)
 └─ workers/embedding.worker.ts  (BullMQ consumer — captions/extracts/embeds a File once)
```

Controllers only orchestrate; services hold the logic (post generation,
hashtag suggestion, recommendation scoring, embedding). AI/LLM access goes
through LangChain's `ChatOllama` / `OllamaEmbeddings` wrappers — swapping to
a hosted provider means changing the model instantiation in
`embedding.service.ts` / `post-generation.service.ts`, not the controllers.

## File moderation workflow (simulated AWS pipeline)

Real system: **S3 upload → Lambda → Step Functions → moderation callback.**
This backend owns everything from the callback onward. Simulated locally as:

1. `POST /files/upload` creates the `File` record with `status: "uploading"`.
2. A short `setTimeout` walks it `uploading → scanning → approved` for local
   demo purposes only (stands in for the real async pipeline).
3. `PATCH /files/:id/status` is the actual callback contract — this is what
   a real Step Functions integration would call. It's **idempotent**:
   calling it twice with the same status is a no-op, not an error.
4. Only on transition to `approved` is the embedding job enqueued — and only
   once (guarded by "does this file already have an embedding").

**Approved-only enforcement** is hardcoded server-side in three places, not
left to callers to request correctly:
- `GET /files` ignores any client-supplied `status` unless `admin=true`.
- `GET /files/:id` returns `404` (not the file) for non-approved files to
  non-admin callers — same response as "doesn't exist", so status isn't
  leaked either.
- `recommendMediaForContent` filters `status: "approved"` in the Mongo
  query itself, before any scoring runs — never as a post-fetch filter.

`tests/files.leak.test.ts` asserts this boundary directly: a rejected file
with a perfect keyword match is proven absent from recommendation results,
and a scanning file is proven absent too, while an approved file with
identical content is proven present (so the test isn't just "always empty").

## AI workflow

**`POST /ai/generate-post`** — `{ prompt, tone?, regenerate?, previousContent? }`
- Empty/whitespace prompt → `400`, never reaches the model.
- `regenerate: true` appends an explicit "don't repeat these" instruction
  built from `previousContent`.
- On provider timeout/failure: never a `500`. Logs the failure, returns
  `200` with a generic templated fallback and `usedFallback: true`.
- On success: `PostModel` row created with `variants`, response includes
  `variations`, `improved` (first variant), `usedFallback: false`.

**`POST /ai/suggest-hashtags`** — `{ content, postId? }`
- Falls back to keyword-derived hashtags (`fallbackHashtagsFromContent`) if
  the model output is empty/unparseable or the call times out — a
  degraded-but-usable result rather than a failure.

**`POST /ai/recommend-media`** — `{ postContent, category?, limit? }`
- See scoring approach below. Empty result set is a normal `200`, not an
  error. Retrieval failing (timeout/exception) degrades to
  `{ recommendations: [], usedFallback: true }` rather than blocking the
  post-save flow — media suggestions are a nice-to-have relative to
  publishing.

Every AI/retrieval call writes a `GenerationLog` row (`Log.model.ts`) with
`requestId`, `provider`, `latencyMs`, `success`, and a short `message`
summary — never the full raw AI output, to keep logs lean and avoid storing
arbitrary user content twice.

## Retrieval / recommendation approach

Cheapest signal first, semantic only where it earns its cost:

1. **Hard filter** — `status: "approved"` (+ `category` if given), in the DB
   query, before scoring. Non-negotiable.
2. **Keyword overlap** — tokenize `postContent`, compare against file
   `name` + `tags` (+ `captionText` for images/video/audio). Zero AI calls,
   near-zero latency, satisfies the minimum bar on its own.
3. **Semantic score (bonus)** — embed only the incoming `postContent`
   (never per-file, per-request); compare against each approved file's
   `embedding` field via cosine similarity. Combined as
   `0.6 * semantic + 0.4 * keyword` when a semantic score exists, keyword
   alone otherwise.
4. **Embeddings are computed once**, at approval time, inside the
   moderation-callback handler (`updateFileStatus`) — a recommendation
   request never triggers a new embedding call for an existing file. This
   was also the actual bug in the original submission: the previous
   recommendation service queried a `ChunkModel`/Atlas collection that
   didn't line up with what the embedding worker wrote per-file, so
   semantic scoring silently degraded to keyword-only in practice. Fixed by
   reading `file.embedding` directly (see `media-recommendation.service.ts`
   patch notes).
5. Results below a minimum relevance threshold (`0.15`) are dropped rather
   than forced — no relevant files found returns `{ recommendations: [] }`,
   not an error, not a weak match.
6. Each result includes a short human-readable `reason`
   (`"matched terms: dental, before-after"` or `"semantic content
   similarity"`).

## Model, cost & compute reflection

| Task | Model tier | Why |
|---|---|---|
| Post generation, content improvement | Capable general LLM (currently `gemma3:4b` via Ollama; swap-in point for GPT-4o-mini/Claude Haiku-tier if hosted quality matters more than local cost) | Output quality directly affects what gets published; low volume per user makes a better model worth the marginal cost |
| Hashtag suggestion | Same lightweight LLM tier | Cheap, short output, doesn't need a bigger model |
| Media recommendation — keyword layer | No model | Pure string/DB compute, zero cost, zero latency risk, and it's the layer that has to work even if every AI provider is down |
| Media recommendation — semantic layer | Local embedding model (`qwen3-embedding:0.6b` via Ollama) | Embeddings don't need creative reasoning; local avoids sending file metadata to a third party, and caching at approval time removes per-call API cost entirely |

Other notes:
- **Latency/reliability**: caching embeddings at approval time instead of
  per-recommendation-request is the single biggest cost/latency lever here.
- **Privacy**: local embedding models are the safer default if a client is
  sensitive about data residency; the generation layer only ever sends
  short prompts/no raw file content, so it's lower risk either way.
- **AWS assumption**: this backend only owns the moderation callback
  (`PATCH /files/:id/status`) and everything downstream of it — actual
  scanning/storage stays the AWS side's responsibility.
- **Scaling assumption**: AI endpoints are stateless, so horizontal scaling
  doesn't require session affinity; BullMQ + Redis already decouples the
  embedding work from the request/response cycle.

## Known limitations

- Document upload currently only accepts PDF/TXT/DOCX (`ALLOWED_DOCUMENT_MIME_TYPES`
  in `file.controller.ts`); image/video/audio ingestion exists in the
  embedding worker but has no upload endpoint wired to it yet — would need
  its own multer config and mime-type branch in `uploadDocument`.
- The demo `setTimeout` moderation walk in `uploadDocument` is for local
  runs only; a real AWS integration would remove it entirely and rely
  solely on the `PATCH /files/:id/status` callback.
- `search.controller.ts`'s system prompt hardcodes a brand identity
  ("Tongston") directly in code — fine for a demo, but should move to
  config/env if this becomes multi-tenant.
- No auth/role system yet — the `admin=true` query flag on `GET /files` is
  a placeholder for a real role check, not a security boundary by itself.
  Treat it as TODO, not done.
- `recommendation.controller.ts` (the older `/recommendations` route) is
  still present alongside the new `/ai/recommend-media` — kept for
  backwards compatibility with anything already calling it, but new
  integrations should use `/ai/recommend-media`, which matches the
  assessment's contract.

## Production-readiness reflection

**What's fragile:** the embedding worker has no retry/backoff visibility
beyond BullMQ's default 3 attempts, and a permanently-down Ollama instance
will silently degrade every AI feature to fallback text rather than
alerting anyone — fine for demo, not fine unmonitored in production.

**What to monitor first:** `GenerationLog` `success: false` rate per `type`
(this is exactly what it's for), embedding queue depth/failure count, and
moderation callback latency (time between `uploading` and `approved`).

**What to improve before production:** real auth on the admin file-list
flag, a proper vendor-agnostic AI provider abstraction (`lib/aiProvider.ts`
in the fuller spec) instead of `ChatOllama` instantiated directly in each
service, and moving the demo `setTimeout` moderation walk behind a feature
flag so it can never accidentally run against a real AWS-backed deployment.

**Assumptions made:** single-tenant deployment, local disk storage is
acceptable short-term (not yet swapped for S3), and MongoDB Atlas Search
vector index setup is done manually and isn't part of this codebase's
responsibility.

**Handover:** another engineer should start at `index.ts` for route wiring,
then `file.controller.ts`'s `updateFileStatus` for the moderation contract,
then `media-recommendation.service.ts` for retrieval — those three files
are the ones most recently changed and most load-bearing for the
gaps this resubmission addresses.
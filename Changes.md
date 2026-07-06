# Summary of Changes — Resubmission

Thanks for the detailed feedback. Here's what changed, mapped to each point raised.

**1. Documentation/handover** — Added `README.md` (setup, architecture, AI workflow,
production-readiness reflection) plus `docs/WORKFLOW.md` (upload pipeline,
worker/SSE progress, RAG search flow) and `docs/MODEL_COST.md` (model
choice and cost/privacy reasoning per media type). Postman collection
included for runnable sample requests/responses.

**2. AWS/S3 moderation workflow** — Added `PATCH /files/:id/status`,
simulating the Step Functions callback (`uploading → scanning →
approved/rejected`). Idempotent: repeat calls with the same status are a
no-op, not an error. `moderatedAt` is set on approve/reject.

**3. Approved-only enforcement** — Hardened server-side in three places:
`GET /files` ignores client-supplied `status` unless `admin=true`;
`GET /files/:id` returns `404` (not the file) for non-approved files to
non-admin callers; the media-recommendation query filters
`status: 'approved'` in MongoDB itself, before any scoring runs. Added
`tests/files.leak.test.ts` proving a rejected file with a perfect keyword
match is never returned, while an approved file with identical content is.

**4. Missing `/ai/recommend-media`** — Implemented and wired, matching the
contract (`postContent`/`category`/`limit` in, `recommendations` with
`fileId`/`name`/`score`/`reason` out).

**5. Recommendation/retrieval logic** — Found and fixed the root cause:
the service was querying a chunk collection that didn't match what the
embedding worker actually wrote per-file, so semantic scoring silently
degraded to keyword-only. Now reads each file's `embedding` directly.
Embeddings are computed once, at approval time — never per recommendation
request.

**6. AI workflow product logic** — Added tone/regenerate support (with an
explicit "don't repeat these" instruction built from prior variants),
malformed-model-output recovery before falling back to a template, and a
tightened post-generation system prompt so keyword-relevant terms survive
across all 3 variants (this was breaking media-recommendation matching for
2 of the 3 variants previously).

**7. Reliability/edge cases** — AI/timeout failures now return `200` with
`usedFallback: true` instead of `500`; empty/whitespace prompts return
`400` before reaching the AI provider; no relevant files returns
`recommendations: []`, not an error.

**8. Model/cost reflection** — See `docs/MODEL_COST.md`: why Ollama
(free, local, no data leaves the machine), per-media-type model choices
(qwen embeddings for text/images-via-caption, moondream for image
captioning instead of a paid multimodal embedder, metadata-only for
audio/video), and the upgrade path if quality needs differ later.

**9. Real secrets in submission** — Removed; `.env.example` added with
placeholder values only.

**10. Production-readiness reflection** — Added to the README: what's
fragile (no alerting on sustained AI-provider downtime beyond fallback
text), what to monitor first (`GenerationLog` failure rate per type,
embedding queue depth, moderation callback latency), what to improve
before production (real auth behind the `admin` flag, a vendor-agnostic AI
provider abstraction instead of direct `ChatOllama` instantiation), and
assumptions made (single-tenant, local disk storage as an interim step
before S3).

**Also included:** a Postman collection + environment covering every
route, for both API testing and using alongside the running frontend.

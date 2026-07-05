# Workflow — Upload Pipeline & Retrieval-Augmented Search

## 1. File upload → embedding pipeline

A user uploads a file via `POST /files/upload`. The file record is created
immediately with a moderation status (`uploading → scanning → approved`),
and the actual embedding work is handed off to a **background worker**
(BullMQ), not done inline in the request.

**Why a worker instead of doing it inline:** a large file's embedding can
take long enough that a user gets impatient and refreshes the page,
assuming the browser is stuck. If embedding happened inline in the request
handler, that refresh would abandon a half-finished upload — the partial
data would already be in the database, and re-uploading would create a
duplicate on top of it. Moving the work into a queued worker means the job
keeps running in the background regardless of what the user's browser
does. If the worker itself fails partway (crash, transient error), BullMQ
retries the job up to 3 attempts before it's pulled from the queue
entirely, instead of leaving a half-embedded file stuck forever.

**Progress visibility:** rather than making the frontend guess when
embedding finishes, the worker emits progress via **Server-Sent Events
(SSE)** — as it processes chunks, it fires progress events that the
frontend subscribes to in real time. This is why the UI can show "X of Y
chunks embedded" live instead of a generic spinner.

**Fallback to polling:** SSE connections can drop (proxies, mobile
networks, tab backgrounding). `GET /files` is polled on a **5-second
interval from the frontend** using SWR (chosen the same way TanStack Query
is used elsewhere — cache + automatic refetch, no manual state
management) as a safety net: if the file list changes status without an
SSE event ever landing, the polling loop still catches it within 5s.

## 2. RAG search pipeline (`GET /search`)

1. **Query embedding** — the user's search query is embedded using the
   same embedding model used at file-approval time (`qwen3-embedding:0.6b`
   via Ollama), so query and document vectors live in the same space.
2. **Semantic retrieval** — that query embedding is compared against
   stored chunk/file embeddings in MongoDB via vector search, returning the
   top `k=10` most similar matches.
3. **Prompt augmentation** — those 10 retrieved passages are concatenated
   with the user's original query and a system instruction into a single
   prompt: `prompt = query + retrieved context + instruction`.
4. **LLM refinement** — that augmented prompt is sent to a larger,
   cloud-hosted model (`gemma3:27b-cloud` via Ollama Cloud) rather than the
   small local model used for post-generation/hashtags. Refining a
   retrieved-context answer benefits more from a stronger model than
   generating a short social post does — this is the one place in the
   system where paying for a bigger model is worth it.
5. **Orchestration** — LangChain (TypeScript) wires steps 1–4 together via
   its RAG/agent primitives rather than hand-rolling the retrieval →
   prompt-construction → generation chain.

## 3. AI post generation (`POST /ai/generate-post`)

A user provides a title/topic and clicks Generate. The request is
validated (non-empty prompt), weak input is normalized to a fuller prompt
before it reaches the model, and the model is instructed via a system
prompt to return exactly 3 variants as a JSON array. Malformed or
non-JSON model output is recovered heuristically (line-splitting on
bullets/numbering) before falling back to a fixed template as an absolute
last resort — so a bad model response degrades gracefully instead of
failing the request outright. Every call — success, malformed-output
recovery, or hard failure — is logged with latency, provider, and outcome.

## 4. Where this differs from a "simple" AI wrapper

The distinguishing choices in this workflow — a worker instead of inline
embedding, SSE + polling instead of one fragile real-time channel, a
separate (larger) model specifically for RAG refinement vs. the smaller
model for short-form generation — are all responses to a concrete failure
mode each one prevents (duplicate uploads on refresh, silent progress with
no feedback, weak answers from a model too small for context synthesis).
None of them are complexity added for its own sake.
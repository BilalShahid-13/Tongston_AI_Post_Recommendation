# Model, Cost & Compute Reflection

## Why Ollama as the base provider

Ollama was chosen because it's free, open-source, and runs entirely
locally — no per-call API cost and no file content or embeddings ever
leave the machine. For a Files & Docs feature where uploaded content might
be sensitive, that's a meaningful default, not just a cost shortcut.

## Embedding model: `qwen3-embedding:0.6b`

Used for both document chunk embeddings and search query embeddings.
Outputs **1024-dimension vectors** — the same dimensionality as OpenAI's
common embedding models, so this isn't a downgrade in representational
capacity, just a different (free, local) provider producing a
comparable-shape vector.

**Upgrade path, if quality ever needs it:** Qwen's embedding family scales
up to a 4B-parameter variant. Swapping to it is a config change (model
name + re-embedding existing files), not an architecture change, because
all embedding calls go through one model reference rather than being
hardcoded per call site.

## Image captioning: `moondream`, not a paid multimodal embedder

Some hosted multimodal embedding models (e.g. Gemini's multimodal
embeddings) can embed an image or video directly, but they're paid,
API-only. Instead, this system uses **moondream** (a small local
vision-language model) to generate a text caption describing what's in the
image, then feeds that caption through the same `qwen3-embedding` pipeline
used for everything else. Net effect: image search works through the same
text-embedding space as documents, at zero marginal API cost, at the price
of losing some visual nuance a true multimodal embedding would capture.
That tradeoff was deliberate — captioning quality was judged "good enough"
for keyword/semantic matching in a media-recommendation context, where the
question is "is this image roughly about X," not "find the exact visual
match."

## Audio/video: metadata only, not full embeddings

Audio and video files are indexed by extracted **metadata** (duration,
format, resolution, etc. converted to descriptive text) rather than by
transcribing/captioning full content. Full audio/video understanding would
require a transcription step (Whisper or similar) plus a separate
embedding pass — meaningfully more infrastructure for a feature where the
brief's explicit guidance was not to over-engineer. This is a known,
intentional scope limit (see README's Known Limitations), not an oversight.

## Cost tier summary

| Task | Model | Cost | Why this tier |
|---|---|---|---|
| Document/query embeddings | `qwen3-embedding:0.6b` (local) | $0/call | Cheap by nature; local avoids sending content to a third party |
| Image understanding | `moondream` (local) | $0/call | Captioning doesn't need a paid multimodal API to be useful for matching |
| Post generation / hashtags | Small local LLM via Ollama | $0/call | Short-form output; a bigger model isn't needed for 1–3 sentence variants |
| RAG answer refinement (`/search`) | `gemma3:27b-cloud` (Ollama Cloud) | Paid per call | This is the one place output quality from a stronger model is worth paying for — synthesizing 10 retrieved passages into a coherent answer benefits from more reasoning capacity than a 0.6b–4b model provides |

## Other reflections

- **Latency:** embeddings are computed once, at file-approval time — never
  recomputed on a recommendation request. This is the single biggest
  cost/latency lever in the system.
- **Privacy:** local-by-default for anything touching raw file content;
  the one paid/cloud call (`/search` refinement) only ever receives the
  user's query text and already-retrieved excerpts, never raw files.
- **Scaling assumption:** if load grows, the worker queue (BullMQ/Redis)
  already decouples embedding work from request/response cycles, so
  scaling the API layer doesn't require also scaling embedding throughput
  in lockstep.
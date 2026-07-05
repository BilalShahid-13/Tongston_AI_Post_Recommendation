import { LogModel } from "@/model/Log.model";
import { PostModel } from "@/model/Post.model";
import { embedPostContent } from "@/services/embedding.service";
import { fallbackHashtagsFromContent, suggestHashtagsForContent } from "@/services/hashtag-suggestion.service";
import { generatePostVariants } from "@/services/post-generation.service";
import { recommendMediaForContent } from "@/services/media-recommendation.service";
import { TimeoutError, withTimeout } from "@/utils/timeout.util";
import { extractJSONArray } from "@/utils/json-extract.util";
import type { Request, Response, NextFunction } from "express";

const GENERATE_TIMEOUT_MS = 20_000;
const HASHTAG_TIMEOUT_MS = 10_000;
const RECOMMEND_TIMEOUT_MS = 8_000;

/**
 * Shared out-of-band logger wrapper
 */
async function logEvent(
  event: string,
  meta: Record<string, unknown> = {},
  message?: string,
  extra: { requestId?: string; provider?: string; latencyMs?: number; success?: boolean; type?: string } = {}
) {
  try {
    await LogModel.create({ event, meta, message, ...extra });
  } catch (err) {
    console.error("Failed to write log entry:", err);
  }
}

/**
 * 💡 Weak-Input Defensive Handler:
 * Transforms empty strings, brief buzzwords, or uninformative text into solid corporate contexts.
 */
function handleWeakInput(prompt: string): string {
  const cleaned = prompt ? prompt.trim() : "";
  if (cleaned.length === 0) {
    return "General corporate update regarding strategic innovation milestones and business ecosystem sustainability metrics.";
  }
  if (cleaned.length < 10) {
    return `An optimized operational review and professional messaging brief regarding our core concept: "${cleaned}".`;
  }
  return cleaned;
}

/**
 * 💡 Malformed Output Mitigation:
 * Recovers usable structures when the LLM spits out raw markdown paragraphs or numbered lists instead of raw JSON.
 */
function parseMalformedOutput(rawOutput: string, processedPrompt: string): string[] {
  // First attempt: try using standard project utility parsing arrays
  const parsed = extractJSONArray(rawOutput);
  if (parsed && parsed.length >= 3) {
    return parsed.slice(0, 3);
  }

  // Fallback recovery: split by structural lines or numeric bullet items
  console.warn("AI returned malformed non-JSON data structure. Initializing heuristic string extraction splits.");
  const lines = rawOutput
    .split(/\n+/)
    .map(line => line.replace(/^[-*\d.\s"']+|["']+$/g, "").trim())
    .filter(line => line.length > 20);

  if (lines.length >= 3) {
    return lines.slice(0, 3);
  }

  // Absolute baseline fallback array if parsing fails completely
  return [
    `We are expanding operations and leveraging key assets to scale out: ${processedPrompt}`,
    `Driving real value through a multi-tiered approach focused on ${processedPrompt}.`,
    `Next steps: Unlocking potential and advancing our strategic framework for ${processedPrompt}.`
  ];
}

// ==========================================
// 1. INITIAL WORKFLOW GENERATION
// POST /ai/generate-post
// ==========================================
export async function generatePost(req: Request, res: Response, next: NextFunction) {
  const { prompt, tone } = req.body ?? {};
  const start = Date.now();

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Please provide a valid prompt text context." });
  }

  const processedPrompt = handleWeakInput(prompt);

  await logEvent("ai_request", { feature: "generate-post" }, processedPrompt.slice(0, 200), {
    requestId: req.requestId,
    type: "post-generation",
  });

  try {
    let effectivePrompt = processedPrompt;
    if (tone && typeof tone === "string") {
      effectivePrompt = `${effectivePrompt}\n\nTone: ${tone}`;
    }

    // Direct structural invocation inside timeout sandbox limits
    const response = await withTimeout(
      generatePostVariants(effectivePrompt),
      GENERATE_TIMEOUT_MS,
      "generate-post"
    );

    // Extract structure with parsing resiliency guarantees
    const variants = parseMalformedOutput(response.variants.join("\n"), processedPrompt);

    // Persist to document model tracking arrays
    const post = await PostModel.create({
      promptInput: prompt.trim(),
      variants: variants.map((content) => ({ content, hashtags: [] })),
      generationHistory: variants, // seed history to guarantee fresh re-rolls
      status: "generated",
      modelUsed: response.modelUsed,
    });

    await logEvent("ai_success", { feature: "generate-post", postId: post._id }, undefined, {
      requestId: req.requestId,
      provider: response.modelUsed,
      latencyMs: Date.now() - start,
      success: true,
      type: "post-generation",
    });

    return res.status(201).json({
      postId: post._id,
      variations: variants,
      status: post.status,
      usedFallback: false,
    });
  } catch (err) {
    const isTimeout = err instanceof TimeoutError;
    await logEvent(
      isTimeout ? "ai_timeout" : "ai_failure",
      { feature: "generate-post" },
      (err as Error).message,
      { requestId: req.requestId, latencyMs: Date.now() - start, success: false, type: "post-generation" }
    );

    // Safe, brand-aligned fallback templates if AI crashes or times out
    const cleanFallbacks = [
      `Excited to announce our latest roadmap improvements centering on ${processedPrompt}.`,
      `Efficiency and scalable operations: How we approach changes within ${processedPrompt}.`,
      `Strategic horizons: Unlocking hidden potential within our focus on ${processedPrompt}.`
    ];

    return res.json({
      variations: cleanFallbacks,
      usedFallback: true,
    });
  }
}

// ==========================================
// 2. REGENERATE / ANTI-REPETITION BEHAVIOR
// POST /ai/posts/:id/regenerate
// ==========================================
export async function regeneratePost(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  const { tone } = req.body ?? {};

  try {
    const post = await PostModel.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Target post history record not found." });
    }

    // Inject history into the prompt configuration as a negative constraint boundary
    let effectivePrompt = post.promptInput;
    if (post.generationHistory && post.generationHistory.length > 0) {
      effectivePrompt += `\n\nCRITICAL DIRECTIVE: Do not repeat or use concepts, hooks or structural phrasing from these previous variants:\n` +
        post.generationHistory.slice(-6).map((ph, index) => `[Previous Variant ${index + 1}]: ${ph}`).join("\n");
    }
    if (tone && typeof tone === "string") {
      effectivePrompt += `\n\nTone required: ${tone}`;
    }

    const response = await withTimeout(
      generatePostVariants(effectivePrompt),
      GENERATE_TIMEOUT_MS,
      "regenerate-post"
    );

    const variants = parseMalformedOutput(response.variants.join("\n"), post.promptInput);

    // Append variants to overall tracking list, but reset active screen variations
    post.variants = variants.map((content) => ({ content, hashtags: [] }));
    post.generationHistory.push(...variants);
    post.modelUsed = response.modelUsed;
    post.status = "generated";
    await post.save();

    return res.json({
      postId: post._id,
      variations: variants,
      status: post.status,
      usedFallback: false,
    });
  } catch (err) {
    console.error("Regeneration cycle pipeline hit an error exception:", err);
    return res.json({
      variations: [`Exploring alternative perspectives about our ongoing structural updates.`],
      usedFallback: true,
    });
  }
}

// ==========================================
// 3. MANUAL EDIT OVERRIDE DRAFT STATE
// PUT /ai/posts/:id/edit
// ==========================================
export async function editPost(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  const { editedContent } = req.body ?? {};

  if (!editedContent || editedContent.trim().length === 0) {
    return res.status(400).json({ error: "Edited strings cannot be blank textual payloads." });
  }

  try {
    const post = await PostModel.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Target post reference does not exist." });
    }

    // Set final text contents and change lifecycle status context into 'draft'
    post.finalContent = editedContent.trim();
    post.status = "draft";
    await post.save();

    return res.json({ success: true, message: "Variant saved as custom draft.", post });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 4. ACCEPT AND LOCK DOWN LIFECYCLE
// PATCH /ai/posts/:id/accept
// ==========================================
export async function acceptPost(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  const { chosenContent, hashtags = [], attachedFiles = [] } = req.body ?? {};

  if (!chosenContent) {
    return res.status(400).json({ error: "Chosen textual parameter content is required to accept post." });
  }

  try {
    const updatedPost = await PostModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "accepted",
          finalContent: chosenContent.trim(),
          finalHashtags: hashtags,
          attachedFiles: Array.isArray(attachedFiles) ? attachedFiles.map((f: any) => f._id || f) : [],
        },
      },
      { new: true }
    );

    if (!updatedPost) {
      return res.status(404).json({ error: "Post database configuration entity missing." });
    }

    // Dispatch embedding calculation out-of-band to safeguard thread latency
    embedPostContent(String(updatedPost._id), chosenContent.trim());
    await logEvent("ai_success", { postId: updatedPost._id, milestone: "post_saved" }, undefined, { requestId: req.requestId });
    return res.json({ success: true, post: updatedPost });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// UTILITY SUBSYSTEMS
// ==========================================
export async function recommendMedia(req: Request, res: Response) {
  const { postContent, category, limit } = req.body ?? {};

  if (typeof postContent !== "string" || postContent.trim().length < 3) {
    return res.status(400).json({ error: "Field 'postContent' is required (min 3 characters)." });
  }

  try {
    const { recommendations, usedFallback } = await withTimeout(
      recommendMediaForContent(postContent.trim(), { category, limit }),
      RECOMMEND_TIMEOUT_MS,
      "recommend-media"
    );
    return res.json({ recommendations, usedFallback });
  } catch (err) {
    return res.json({ recommendations: [], usedFallback: true });
  }
}

export async function suggestHashtags(req: Request, res: Response) {
  const { content, postId } = req.body ?? {};

  if (typeof content !== "string" || content.trim().length < 3) {
    return res.status(400).json({ error: "Post content context needed for hashtag evaluation." });
  }

  try {
    const hashtags = await withTimeout(
      suggestHashtagsForContent(content.trim()),
      HASHTAG_TIMEOUT_MS,
      "suggest-hashtags"
    );

    if (postId) {
      await PostModel.updateOne({ _id: postId }, { $set: { finalHashtags: hashtags } });
    }

    return res.json({ hashtags });
  } catch (err) {
    return res.json({ hashtags: fallbackHashtagsFromContent(content.trim()) });
  }
}
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { extractJSONArray } from "@/utils/json-extract.util";

const generationModel = new ChatOllama({
  model: process.env.OLLAMA_TEXT_MODEL || "gemma3:4b",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
});

const SYSTEM_PROMPT = `You are an expert social media copywriter and brand strategist for Tongston.

Your goal is to produce exactly 3 highly descriptive, structurally diverse, and context-rich social post variants based on the user's prompt. 

CRITICAL FOR RETRIEVAL LAYER: To ensure downstream media and asset recommendation engines work flawlessly, explicitly weave descriptive keywords, logical context, functional assets, and situational details into the posts. Avoid superficial or overly brief summaries.

Generate exactly 3 specific variations matching these angles:
1. Direct & Informative: Clear, concise corporate messaging highlighting the central topic, functional milestones, and structural value.
2. Narrative & Engaging: Rephrased from a storytelling perspective, focusing on real-world application, user impact, and domain challenges.
3. Industry Perspective / Alternative Angle: A thought-leadership style hook analyzing the theme, broad context, or ecosystem sustainability.

Respond ONLY with a valid JSON array of exactly 3 strings. Do not include markdown fences, numbered lists, blockquotes, or markdown bold symbols inside the text strings. No conversational explanation outside the array.

Example output format:
["First distinct informative post text incorporating contextual nouns...", "Second storytelling post text highlighting situational application details...", "Third alternative thought-leadership angle evaluating long-term framework trends..."]`;

export interface GeneratePostResult {
  variants: string[];
  modelUsed: string;
}

export async function generatePostVariants(prompt: string): Promise<GeneratePostResult> {
  const response = await generationModel.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(prompt),
  ]);

  const raw = response.content?.toString() ?? "";
  const parsed = extractJSONArray(raw);

  if (parsed && parsed.length > 0) {
    return { variants: parsed.slice(0, 3), modelUsed: generationModel.model };
  }

  // Weak/non-JSON output — degrade gracefully to the raw text as a single
  // variant instead of failing the whole request. Spec: "AI output quality
  // is weak" must still produce something usable.
  const fallbackText = raw.trim();
  if (fallbackText.length > 0) {
    return { variants: [fallbackText], modelUsed: generationModel.model };
  }

  throw new Error("AI returned an empty response");
}
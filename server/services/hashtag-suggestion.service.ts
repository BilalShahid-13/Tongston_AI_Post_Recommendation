import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { extractJSONArray } from "@/utils/json-extract.util";

const hashtagModel = new ChatOllama({
  model: process.env.OLLAMA_TEXT_MODEL || "gemma3:4b",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
});

const SYSTEM_PROMPT = `Generate 3 to 6 relevant, short social media hashtags for the
given post content. Respond ONLY with a JSON array of strings, no "#" symbol,
no spaces inside a tag, no explanation.
Example: ["summersale", "newcollection", "shoplocal"]`;

function sanitizeTag(tag: string): string {
  return tag.replace(/^#/, "").replace(/\s+/g, "").trim();
}

// Used both as an in-service fallback (weak/unparseable AI output) and as
// a controller-level fallback (AI service unreachable/timeout). Not
// "smart", but keeps the feature usable instead of returning nothing.
export function fallbackHashtagsFromContent(content: string): string[] {
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 4);

  return Array.from(new Set(words)).slice(0, 4);
}

export async function suggestHashtagsForContent(content: string): Promise<string[]> {
  const response = await hashtagModel.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(content),
  ]);

  const raw = response.content?.toString() ?? "";
  const parsed = extractJSONArray(raw);

  if (parsed && parsed.length > 0) {
    return parsed.map(sanitizeTag).filter(Boolean).slice(0, 6);
  }

  return fallbackHashtagsFromContent(content);
}
// AI text models often wrap JSON in markdown fences or add stray prose
// before/after the array — pull just the array out instead of trusting
// JSON.parse on the raw string.
export function extractJSONArray(raw: string): string[] | null {
  if (!raw) return null;
  const match = raw.match(/\[[\s\S]*\]/);
  const candidate = match ? match[0] : raw;

  try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === "string" && item.trim().length > 0);
    }
    return null;
  } catch {
    return null;
  }
}
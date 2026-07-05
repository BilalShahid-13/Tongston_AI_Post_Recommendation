export interface GeneratePostResponse {
  postId: string;
  variations: string[];
  status: string;
  usedFallback: boolean;
}

export interface MediaRecommendation {
  fileId: string;
  name: string;
  score: number;
}

export interface RecommendMediaResponse {
  recommendations: MediaRecommendation[];
  usedFallback: boolean;
}

export interface SuggestHashtagsResponse {
  hashtags: string[];
}

async function requestJSON<T>(path: string, method: string, body?: unknown): Promise<T> {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const res = await fetch(`/api/${cleanPath}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// 🚀 INITIAL GENERATION
export const generatePost = (prompt: string, tone?: string) =>
  requestJSON<GeneratePostResponse>("/ai/generate-post", "POST", { prompt, tone });

// 🔄 REGENERATE (Anti-repetition endpoint call)
export const regeneratePost = (id: string, tone?: string) =>
  requestJSON<GeneratePostResponse>(`/ai/posts/${id}/regenerate`, "POST", { tone });

// 📝 EDIT (Draft synchronization)
export const editPost = (id: string, editedContent: string) =>
  requestJSON<{ success: boolean }>(`/ai/posts/${id}/edit`, "PUT", { editedContent });

// ✅ ACCEPT & LOCK DOWN
export const acceptPost = (id: string, chosenContent: string, hashtags: string[], attachedFiles: string[]) =>
  requestJSON<{ success: boolean }>(`/ai/posts/${id}/accept`, "PATCH", { chosenContent, hashtags, attachedFiles });

// 🎯 RECOMMEND MEDIA
export const recommendMedia = (postContent: string, opts?: { category?: string; limit?: number }) =>
  requestJSON<RecommendMediaResponse>("/ai/recommend-media", "POST", {
    postContent,
    category: opts?.category,
    limit: opts?.limit,
  });

// #️⃣ SUGGEST HASHTAGS
export const suggestHashtags = (content: string, postId: string) =>
  requestJSON<SuggestHashtagsResponse>("/ai/suggest-hashtags", "POST", { content, postId });
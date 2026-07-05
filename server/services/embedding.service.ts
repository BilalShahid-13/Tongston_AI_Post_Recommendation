import { OllamaEmbeddings } from "@langchain/ollama";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage } from "@langchain/core/messages";
import fs from "fs";
import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { PostModel } from "@/model/Post.model";

const EXPECTED_DIMENSIONS = 1024; // qwen3-embedding:0.6b output size

const EMBEDDING_MODEL = "qwen3-embedding:0.6b";
const CAPTION_MODEL = "moondream";

export const embeddingModel = new OllamaEmbeddings({
  model: EMBEDDING_MODEL,
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
});

const captionModel = new ChatOllama({
  model: CAPTION_MODEL,
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
});

const client = new MongoClient(process.env.MONGO_URI!);
// const collection = client
//   .db(process.env.MONGODB_ATLAS_DB_NAME)
//   .collection(process.env.MONGODB_ATLAS_COLLECTION_NAME as string);
const collection = client
  .db("rag_db")
  .collection("document_chunks");

export const vectorStore = new MongoDBAtlasVectorSearch(embeddingModel, {
  collection,
  indexName: "vector_index", // Must match the index name in your Atlas cluster
  textKey: "text",
  embeddingKey: "embedding",
});

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  try {
    const vector = await embeddingModel.embedQuery(text);
    if (!vector || vector.length === 0) {
      throw new Error("Embedding model returned empty vector");
    }
    if (vector.length !== EXPECTED_DIMENSIONS) {
      throw new Error(
        `Embedding dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${vector.length}`
      );
    }
    return vector;
  } catch (err) {
    console.error("generateEmbedding failed:", err);
    throw new Error(`Embedding generation failed: ${(err as Error).message}`);
  }
}

export async function generateImageCaption(imagePath: string, mimeType: string): Promise<string> {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const message = new HumanMessage({
      content: [
        {
          type: "text",
          text: "Describe this image in one concise sentence, focusing on objects, setting, and context useful for search.",
        },
        {
          type: "image_url",
          image_url: `data:${mimeType};base64,${base64Image}`, // ✅ ab dynamic
        },
      ],
    });

    const response = await captionModel.invoke([message]);
    const caption = response.content?.toString().trim();

    if (!caption) {
      throw new Error("Caption model returned empty response");
    }
    return caption;
  } catch (err) {
    console.error("generateImageCaption failed:", err);
    throw new Error(`Image captioning failed: ${(err as Error).message}`);
  }
}


export async function embedPostContent(postId: string, content: string): Promise<void> {
  if (!content || content.trim().length === 0) return;

  try {
    const embedding = await embeddingModel.embedQuery(content);
    await PostModel.findByIdAndUpdate(postId, { embedding });
  } catch (err) {
    console.error(`Failed to embed post ${postId}:`, err);
  }
}
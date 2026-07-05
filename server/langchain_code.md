import { OllamaEmbeddings } from "@langchain/ollama";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { Document } from "@langchain/core/documents";

// 1. Initialize the embedding model
const embeddings = new OllamaEmbeddings({
  model: "qwen3-embedding:0.6b",
  baseUrl: "http://localhost:11434",
});

// 2. Initialize the vector store (assuming 'collection' is already defined)
const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
  collection: collection,
  indexName: "vector_index",
  textKey: "text",
  embeddingKey: "embedding",
});

// 3. Store your documents
const docs = [
  new Document({ pageContent: "Example content from PDF or Word doc" }),
  new Document({ pageContent: "Another document content" }),
];

await vectorStore.addDocuments(docs);



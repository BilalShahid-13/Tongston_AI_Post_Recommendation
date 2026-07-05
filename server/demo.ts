import { OllamaEmbeddings } from "@langchain/ollama";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import path from "path";

const filePath = path.join(__dirname, "public", "General Knowledge 12th August.pdf");

// Initialize Ollama Embeddings
const embeddings = new OllamaEmbeddings({
    model: "qwen3-embedding:0.6b",
    baseUrl: "http://localhost:11434",
});

// Setup MongoDB
const MONGODB_URI = process.env.MONGO_URI || "";
const client = new MongoClient(MONGODB_URI);
const collection = client.db("tongston-assessment").collection("chunks");

// Initialize Vector Store
const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
    collection: collection as any,
    indexName: "vector_index", // Ensure this index exists in MongoDB
    textKey: "text",
    embeddingKey: "embedding",
});

// Load and process PDF
const loader = new PDFLoader(filePath);
const docs = await loader.load();

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
});
const splits = await splitter.splitDocuments(docs);

// Add to MongoDB
await vectorStore.addDocuments(splits);


const query = "What is the summary of this document?";
const results = await vectorStore.similaritySearch(query, 3);

// results.forEach((doc) => {
//     // console.log(doc.pageContent);
// });
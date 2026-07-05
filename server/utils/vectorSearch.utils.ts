import { generateEmbedding } from "@/services/embedding.service";
import { MongoClient } from "mongodb";

interface SearchResult {
    text: string;
}

// 🚀 Dedicated client isolation connection taaki standard match ho ske
let searchClient: MongoClient | null = null;

export async function vectorSearch(queryText: string, limit = 10): Promise<SearchResult[]> {
    // 1. Connection check aur initialize
    if (!searchClient) {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI environment variable missing!");
        }
        searchClient = new MongoClient(process.env.MONGO_URI);
        await searchClient.connect();
    }

    // 2. Exact same database configuration load karein jo LangChain use kr rha hai
    const db = searchClient.db();

    const collection = db.collection("chunks");

    // Runtime doc confirmation log line
    const totalDocs = await collection.countDocuments();

    if (totalDocs === 0) {
        console.warn("⚠️ Warning: Collection has NO documents in this database scope.");
        return [];
    }

    // 3. Generate embedding vector string 
    const queryVector = await generateEmbedding(queryText);

    // 4. Executing exact aggregate stage block
    // const results = await collection.aggregate([
    //     {
    //         $vectorSearch: {
    //             index: "vector_index",
    //             path: "embedding",
    //             queryVector,
    //             numCandidates: 100,
    //             limit,
    //         },
    //     },
    //     {
    //         $project: {
    //             text: 1,
    //             _id: 0
    //         }
    //     },
    // ]).toArray();
    // 4. Executing exact aggregate stage block with Score Filtering
    const results = await collection.aggregate([
        {
            $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector,
                numCandidates: 100,
                limit,
            },
        },
        {
            $project: {
                text: 1,
                _id: 0,
                score: { $meta: "vectorSearchScore" } // 👈 Meta score extraction active karein
            }
        },
        {
            $match: {
                score: { $gte: 0.50 } // 👈 Sirf 50% ya usse behtar matching results aane dein (Trash chunks clean ho jayenge)
            }
        },
        {
            $project: {
                score: 0 // Frontend par score bhejna zaroori nahi, toh project se hide kar sakte hain
            }
        }
    ]).toArray();

    return results as unknown as SearchResult[];
}
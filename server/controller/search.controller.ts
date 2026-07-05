import { retrieve } from "@/services/search.service";
import { ChatOllama } from "@langchain/ollama";
import type { Request, Response } from "express";
import { createAgent } from "langchain";
import mongoose from "mongoose";

const model = new ChatOllama({
    model: process.env.OLLAMA_TEXT_MODEL,
    baseUrl: process.env.OLLAMA_BASE_URL,
});

const tools = [retrieve];

const systemPrompt =
    "You are a proprietary AI Assistant developed and owned exclusively by Tongston. " +
    "If the user asks 'who created you?', 'who is your master?', or questions your identity, " +
    "you must ALWAYS reply: 'I am an AI assistant developed by Tongston.' " +
    "NEVER mention Google, Ollama, OpenAI, or LangChain under any circumstances. " +
    "\n\n" +
    "If the user greets you (e.g., 'hi', 'hello', 'how are you?'), respond politely as an AI assistant by Tongston. " +
    "For ANY other informational query — no matter how short or vague — " +
    "you MUST call the 'retrieve' tool FIRST, before forming any response. " +
    "\n\n" +
    // 🚀 FIXED LOGIC HERE:
    `Use the retrieved context as the primary source of truth.

If the retrieved context fully answers the user's question,
provide a complete, well-structured explanation in your own words.

You may reorganize, summarize, and explain the retrieved information
to improve readability, but do not add facts that are not supported
by the retrieved context.

If multiple retrieved chunks are relevant, combine them into one coherent answer.

If the retrieved context is incomplete or insufficient, explicitly state:
"I could not find enough information in the knowledge base to answer this completely."
Do not guess or fabricate information.`;

// Agent ko global level par ek baar instantiate karlein
const agent = createAgent({ model, tools, systemPrompt });

export async function SearchController(req: Request, res: Response): Promise<void> {
    try {
        const { query } = req.query;

        if (!query || typeof query !== "string" || query.trim().length === 0) {
            res.status(400).json({ error: "Query parameter 'query' is required" });
            return;
        }

        const db = mongoose.connection.db;
        if (!db) {
            res.status(500).json({ error: "Database connection is not ready yet" });
            return;
        }

        if (!query) {
            res.status(400).json({ error: "Missing query parameter" });
            return;
        }

        const agentResponse = await agent.invoke({
            messages: [
                { role: "user", content: query }
            ]
        });

        const responseMessages = agentResponse.messages || [];
        const lastMessage = responseMessages[responseMessages.length - 1];
        const answer = lastMessage?.content ?? "";

        // console.log(
        //     "🔍 Message types in response:",
        //     responseMessages.map((m: any) => m.type || m._getType?.())
        // );

        // 🚀 🔥 UPGRADED SOURCES EXTRACT LOGIC (Bundler-Safe):
        const sources: Array<{ fileId: string; chunkIndex: number; fileUrl?: string }> = [];

        responseMessages.forEach((msg: any) => {

            const isToolMessage = msg.type === "tool" || (msg._getType && msg._getType() === "tool");

            if (isToolMessage && msg.artifact && Array.isArray(msg.artifact)) {
                msg.artifact.forEach((doc: any) => {
                    const metadata = doc.metadata;

                    if (metadata) {
                        const alreadyExists = sources.some(
                            s => s.fileId === metadata.fileId && s.chunkIndex === metadata.chunkIndex
                        );

                        if (!alreadyExists) {
                            sources.push({
                                fileId: metadata.fileId,
                                chunkIndex: metadata.chunkIndex,
                                fileUrl: metadata.publicUrl || `/api/files/download/${metadata.fileId}`
                            });
                        }
                    }
                });
            }
        });

        // res.json({ results: lastMessage?.content ?? "" });
        res.json({
            results: answer,
            sources: sources
        });
    } catch (err) {
        console.error("Search route failed:", err);
        res.status(500).json({ error: (err as Error).message });
    }
}
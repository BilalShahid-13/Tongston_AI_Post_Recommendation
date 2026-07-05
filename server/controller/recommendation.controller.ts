// controller/recommendation.controller.ts
import { recommendMediaForContent } from "@/services/media-recommendation.service";
import type { Request, Response } from "express";

export async function RecommendationController(req: Request, res: Response): Promise<void> {
    try {
        const { content } = req.body; // ✅ POST body — real-time typing ke liye GET se better (body mein lamba text bhej sakte ho)

        if (!content || typeof content !== "string") {
            res.status(400).json({ error: "Field 'content' is required" });
            return;
        }

        const result = await recommendMediaForContent(content);
        res.json(result);
    } catch (err) {
        console.error("Recommendation failed:", err);
        res.status(500).json({ error: (err as Error).message });
    }
}
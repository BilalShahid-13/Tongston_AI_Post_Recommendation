import { Router } from "express";
import type { Request, Response } from "express";
import { sseManager } from "@/sse/sse.manager";

const sseRouter = Router();

// GET /sse/embedding-progress/:fileId
sseRouter.get("/embedding-progress/:fileId", (req: Request, res: Response) => {
    const { fileId } = req.params;

    if (!fileId || typeof fileId !== "string") {
        return res.status(400).json({ error: "fileId is required" });
    }

    // SSE headers — required for the connection to stay open and stream events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sseManager.addClient(fileId, res);

    // initial event so frontend knows the stream is live
    res.write(`data: ${JSON.stringify({ fileId, connected: true })}\n\n`);

    // cleanup when client disconnects (closes tab, navigates away, etc.)
    req.on("close", () => {
        sseManager.removeClient(res);
    });
});

export default sseRouter;
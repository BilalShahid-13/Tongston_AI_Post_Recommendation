import {
    acceptPost,
    editPost,
    generatePost,
    recommendMedia,
    regeneratePost,
    suggestHashtags
} from "@/controller/ai.controller";
import { Router } from "express";

const aiRouter = Router();

// AI-assisted post creation — accepts topic/prompt/partial text,
// returns suggested content + alternative variations
aiRouter.post("/generate-post", generatePost);
aiRouter.post("/posts/:id/regenerate", regeneratePost);
aiRouter.put("/posts/:id/edit", editPost);
aiRouter.patch("/posts/:id/accept", acceptPost);
// aiRouter.post("/save-post", saveGeneratedPost);

// post content. Hard approved-only filter lives in the service layer.
aiRouter.post("/recommend-media", recommendMedia);

// AI recommendation enhancements — hashtag suggestions for a post
aiRouter.post("/suggest-hashtags", suggestHashtags);

export default aiRouter;
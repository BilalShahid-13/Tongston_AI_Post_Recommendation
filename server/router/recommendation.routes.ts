// router/recommendation.router.ts
import { RecommendationController } from "@/controller/recommendation.controller";
import { Router } from "express";

const recommendationRouter = Router();
recommendationRouter.post("/", RecommendationController);

export default recommendationRouter;
import { Router } from "express";
import { SearchController } from "@/controller/search.controller"; // ✅ yeh line add karo

const searchRouter = Router();

searchRouter.get("/", SearchController);

export default searchRouter;
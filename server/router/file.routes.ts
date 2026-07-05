import {
    deleteFile,
    deleteProcessingFile,
    getFileById,
    getFileProgress,
    getFiles,
    uploadDocument,
} from "@/controller/file.controller";
import { upload } from "@/middlewares/upload.middleware";
import { Router } from "express";

const fileRouter = Router();

fileRouter.post("/upload", upload.single("file"), uploadDocument);
fileRouter.get("/", getFiles);
fileRouter.get("/:id", getFileById);
fileRouter.get("/:id/progress", getFileProgress);
fileRouter.delete("/:id", deleteFile);
fileRouter.delete("/inProcessing/:id", deleteProcessingFile);

export default fileRouter;
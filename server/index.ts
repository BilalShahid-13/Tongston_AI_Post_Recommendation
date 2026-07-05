import { connectDB } from "@/config/db.config";
import cors from "cors";
import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";

import { requestId } from "@/middlewares/Requestid.middleware";

// Routes
import aiRouter from "@/router/ai.routes";
import fileRouter from "@/router/file.routes";
import sseRouter from "@/router/sse.routes";
import recommendationRouter from "./router/recommendation.routes";
import searchRouter from "./router/search.routes";

// Workers — importing starts them listening on their queues
import "./workers/embedding.worker";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(requestId); // every request gets an x-request-id, used in GenerationLog rows
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "public", "uploads")),
);

app.use("/files", fileRouter);
app.use("/sse", sseRouter);
app.use("/search", searchRouter);
// app.use("/recommendations", recommendationRouter);
app.use("/ai", aiRouter);

async function startServer() {
  await connectDB();

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

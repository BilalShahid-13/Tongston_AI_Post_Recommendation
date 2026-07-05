import { connection } from "@/config/redis.config";
import { FileModel } from "@/model/File.model";
import { chunkTextStream } from "@/services/chunking.service";
import { vectorStore } from "@/services/embedding.service";
import { extractTextFromFile } from "@/services/parser.service";
import { sseManager } from "@/sse/sse.manager";
import { Document } from "@langchain/core/documents";
import { Job, Worker } from "bullmq";

interface EmbeddingJobData {
  fileId: string;
}

export interface DocumentType {
  pageContent: string,
  metadata: {
    fileId:string,
    chunkIndex: number,
  },
}

const embeddingWorker = new Worker<EmbeddingJobData>(
  "embedding",
  async (job: Job<EmbeddingJobData>) => {
    const { fileId } = job.data;

    const file = await FileModel.findById(fileId);

    if (!file) {
      throw new Error(`File ${fileId} not found`);
    }

    // Initial state set karein
    await FileModel.findByIdAndUpdate(fileId, {
      embeddingStatus: "processing",
      processedChunks: 0,
    });

    if (file.type !== "document") {
      await FileModel.findByIdAndUpdate(fileId, {
        embeddingStatus: "failed",
      });

      return {
        fileId,
        status: "skipped",
        reason: `Embedding not implemented for ${file.type}`,
      };
    }

    const rawText = await extractTextFromFile(
      file.storagePath,
      file.mimeType
    );

    // --- PHASE 1: Total chunks count maloom karna ---
    let totalChunks = 0;
    for await (const _ of chunkTextStream(rawText)) {
      totalChunks++;
      sseManager.sendProgress(fileId, {
        status: "counting",
        totalChunks
      });
    }

    // Agar text empty nikla ya koi chunk nahi bana
    if (totalChunks === 0) {
      await FileModel.findByIdAndUpdate(fileId, {
        embeddingStatus: "completed",
        totalChunks: 0,
        processedChunks: 0,
      });

      await job.updateProgress(100);

      sseManager.sendProgress(fileId, {
        status: "completed",
        processedChunks: 0,
        totalChunks: 0,
        progress: 100,
      });

      return {
        fileId,
        totalChunks: 0,
        status: "completed",
      };
    }

    // Database mein total chunks save karein taake progress track ho sake
    await FileModel.findByIdAndUpdate(fileId, {
      totalChunks,
      processedChunks: 0,
    });

    // --- PHASE 2: Chunks Batching & Embedding Generation ---
    const batchSize = 20;
    let processedChunks = 0;
    let docs: Document[] = [];

    for await (const chunkTextContent of chunkTextStream(rawText)) {
      docs.push(
        new Document({
          pageContent: chunkTextContent,
          metadata: {
            fileId,
            chunkIndex: processedChunks,
          },
        })
      );

      processedChunks++;

      // Jab batch size hit ho jaye, db mein push karein aur frontend ko batayein
      if (docs.length >= batchSize) {
        await vectorStore.addDocuments(docs);
        docs = []; // Batch empty karein

        await FileModel.findByIdAndUpdate(fileId, {
          processedChunks,
        });

        const progress = Math.round((processedChunks / totalChunks) * 100);

        await job.updateProgress(progress);
        sseManager.sendProgress(fileId, {
          status: "processing",
          processedChunks,
          totalChunks,
          progress,
        });
      }
    }

    // --- PHASE 3: Remaining Docs (Leftovers) Handle Karna ---
    if (docs.length > 0) {
      await vectorStore.addDocuments(docs);

      // Batch loop ke bache huay chunks count ko total mein add karein
      processedChunks += docs.length;

      await FileModel.findByIdAndUpdate(fileId, {
        processedChunks,
      });

      const finalProgress = Math.round((processedChunks / totalChunks) * 100);
      await job.updateProgress(finalProgress);

      sseManager.sendProgress(fileId, {
        status: "processing",
        processedChunks,
        totalChunks,
        progress: finalProgress,
      });
    }

    // --- PHASE 4: Final Successful Completion State ---
    await FileModel.findByIdAndUpdate(fileId, {
      embeddingStatus: "completed",
      totalChunks,
      processedChunks: totalChunks,
    });

    await job.updateProgress(100);

    // Final Event pure 100% progress ke sath broadcast karein
    sseManager.sendProgress(fileId, {
      status: "completed",
      processedChunks: totalChunks,
      totalChunks,
      progress: 100,
    });

    return {
      fileId,
      totalChunks,
      status: "completed",
    };
  },
  { connection }
);
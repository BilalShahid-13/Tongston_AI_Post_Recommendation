import { connection } from "@/config/redis.config";
import { FileModel } from "@/model/File.model";
import { chunkTextStream } from "@/services/chunking.service";
import { vectorStore, generateImageCaption } from "@/services/embedding.service";
import { extractTextFromFile } from "@/services/parser.service";
import { sseManager } from "@/sse/sse.manager";
import { Document } from "@langchain/core/documents";
import { Job, Worker } from "bullmq";

interface EmbeddingJobData {
    fileId: string;
}

const embeddingWorker = new Worker<EmbeddingJobData>(
    "embedding",
    async (job: Job<EmbeddingJobData>) => {
        const { fileId } = job.data;
        const file = await FileModel.findById(fileId);
        if (!file) throw new Error(`File ${fileId} not found`);

        await FileModel.findByIdAndUpdate(fileId, {
            embeddingStatus: "processing",
            processedChunks: 0,
        });

        // ✅ Switch-case — har file type ka apna dedicated processing function
        switch (file.type) {
            case "document":
                return await processDocument(fileId, file, job);

            case "image":
                return await processImage(fileId, file, job);

            case "video":
                // 🔜 Future: video frame extraction + captioning + embedding
                return await processVideo(fileId, file, job); // ✅ ab implement ho gaya
            case "audio":
                // 🔜 Future: audio transcription (Whisper) + embedding
                return await processAudio(fileId, file, job); // ✅ ab implement ho gaya
            default:
                return await markUnsupported(fileId, file.type);
        }
    },
    { connection }
);

// ===== Document Processing (already working) =====
async function processDocument(fileId: string, file: any, job: Job) {
    const rawText = await extractTextFromFile(file.storagePath, file.mimeType);

    let totalChunks = 0;
    for await (const _ of chunkTextStream(rawText)) {
        totalChunks++;
        sseManager.sendProgress(fileId, { status: "counting", totalChunks });
    }

    if (totalChunks === 0) {
        await FileModel.findByIdAndUpdate(fileId, {
            embeddingStatus: "completed",
            totalChunks: 0,
            processedChunks: 0,
        });
        await job.updateProgress(100);
        sseManager.sendProgress(fileId, { status: "completed", processedChunks: 0, totalChunks: 0, progress: 100 });
        return { fileId, totalChunks: 0, status: "completed" };
    }

    await FileModel.findByIdAndUpdate(fileId, { totalChunks, processedChunks: 0 });

    const batchSize = 20;
    let processedChunks = 0;
    let docs: Document[] = [];

    for await (const chunkTextContent of chunkTextStream(rawText)) {
        docs.push(
            new Document({
                pageContent: chunkTextContent,
                metadata: { fileId, chunkIndex: processedChunks, publicUrl: file.publicUrl },
            })
        );

        processedChunks++;

        if (docs.length >= batchSize) {
            await vectorStore.addDocuments(docs);
            docs = [];

            await FileModel.findByIdAndUpdate(fileId, { processedChunks });
            const progress = Math.round((processedChunks / totalChunks) * 100);
            await job.updateProgress(progress);
            sseManager.sendProgress(fileId, { status: "processing", processedChunks, totalChunks, progress });
        }
    }

    if (docs.length > 0) {
        await vectorStore.addDocuments(docs);
        processedChunks += docs.length;
        await FileModel.findByIdAndUpdate(fileId, { processedChunks });
        const finalProgress = Math.round((processedChunks / totalChunks) * 100);
        await job.updateProgress(finalProgress);
        sseManager.sendProgress(fileId, { status: "processing", processedChunks, totalChunks, progress: finalProgress });
    }

    await FileModel.findByIdAndUpdate(fileId, {
        embeddingStatus: "completed",
        totalChunks,
        processedChunks: totalChunks,
    });
    await job.updateProgress(100);
    sseManager.sendProgress(fileId, { status: "completed", processedChunks: totalChunks, totalChunks, progress: 100 });

    return { fileId, totalChunks, status: "completed" };
}

// ===== Image Processing (NEW) =====
async function processImage(fileId: string, file: any, job: Job) {
    sseManager.sendProgress(fileId, { status: "processing", processedChunks: 0, totalChunks: 1, progress: 10 });

    // 1. Moondream se caption generate karo
    const caption = await generateImageCaption(file.storagePath, file.mimeType);

    await FileModel.findByIdAndUpdate(fileId, { captionText: caption });
    sseManager.sendProgress(fileId, { status: "processing", processedChunks: 0, totalChunks: 1, progress: 50 });

    // 2. Caption text ko ek single "document" treat karo aur embed karo
    const doc = new Document({
        pageContent: caption,
        metadata: { fileId, chunkIndex: 0, publicUrl: file.publicUrl },
    });

    await vectorStore.addDocuments([doc]);

    await FileModel.findByIdAndUpdate(fileId, {
        embeddingStatus: "completed",
        totalChunks: 1,
        processedChunks: 1,
    });

    await job.updateProgress(100);
    sseManager.sendProgress(fileId, { status: "completed", processedChunks: 1, totalChunks: 1, progress: 100 });

    return { fileId, totalChunks: 1, status: "completed", caption };
}

import { extractMediaMetadata, metadataToText } from "@/services/metadata.service";

// ===== Video Processing (metadata-only) =====
async function processVideo(fileId: string, file: any, job: Job) {
    sseManager.sendProgress(fileId, { status: "processing", processedChunks: 0, totalChunks: 1, progress: 20 });

    const meta = await extractMediaMetadata(file.storagePath);
    const metadataText = metadataToText(file.name, "video", meta);

    await FileModel.findByIdAndUpdate(fileId, { captionText: metadataText });
    sseManager.sendProgress(fileId, { status: "processing", processedChunks: 0, totalChunks: 1, progress: 60 });

    const doc = new Document({
        pageContent: metadataText,
        metadata: { fileId, chunkIndex: 0 },
    });

    await vectorStore.addDocuments([doc]);

    await FileModel.findByIdAndUpdate(fileId, {
        embeddingStatus: "completed",
        totalChunks: 1,
        processedChunks: 1,
    });

    await job.updateProgress(100);
    sseManager.sendProgress(fileId, { status: "completed", processedChunks: 1, totalChunks: 1, progress: 100 });

    return { fileId, totalChunks: 1, status: "completed", metadataText };
}

// ===== Audio Processing (metadata-only) =====
async function processAudio(fileId: string, file: any, job: Job) {
    sseManager.sendProgress(fileId, { status: "processing", processedChunks: 0, totalChunks: 1, progress: 20 });

    const meta = await extractMediaMetadata(file.storagePath);
    const metadataText = metadataToText(file.name, "audio", meta);

    await FileModel.findByIdAndUpdate(fileId, { captionText: metadataText });
    sseManager.sendProgress(fileId, { status: "processing", processedChunks: 0, totalChunks: 1, progress: 60 });

    const doc = new Document({
        pageContent: metadataText,
        metadata: { fileId, chunkIndex: 0 },
    });

    await vectorStore.addDocuments([doc]);

    await FileModel.findByIdAndUpdate(fileId, {
        embeddingStatus: "completed",
        totalChunks: 1,
        processedChunks: 1,
    });

    await job.updateProgress(100);
    sseManager.sendProgress(fileId, { status: "completed", processedChunks: 1, totalChunks: 1, progress: 100 });

    return { fileId, totalChunks: 1, status: "completed", metadataText };
}

// ===== Unsupported types (video/audio — abhi pending) =====
async function markUnsupported(fileId: string, type: string) {
    await FileModel.findByIdAndUpdate(fileId, { embeddingStatus: "failed" });
    return { fileId, status: "skipped", reason: `Embedding not yet implemented for type: ${type}` };
}

export default embeddingWorker;
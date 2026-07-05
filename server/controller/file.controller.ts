import { ChunkModel } from "@/model/chunk.model";
import type { Request, Response } from "express";
import fs from "fs";
import { MongoClient } from "mongodb";
import { Types } from "mongoose";
import { FileModel, type FileStatus } from "../model/File.model";
import { embeddingQueue } from "../queue/embedding.queue";
import { getFileTypeFromMime, isAllowedMimeType } from "@/utils/file-type.util";
import { LogModel } from "@/model/Log.model";

const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

// POST /files/upload — document only for now
export async function uploadDocument(req: Request, res: Response) {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // restrict to document types only — reject everything else for now
    if (!isAllowedMimeType(file.mimetype)) {
      fs.unlink(file.path, () => { });
      return res.status(400).json({
        error: `Unsupported file type: ${file.mimetype}. Supported: PDF, DOCX, TXT, JPEG, PNG, WEBP.`,
      });
    }

    const fileType = getFileTypeFromMime(file.mimetype)!;
    const publicUrl = `${process.env.API_BASE_URL}/uploads/${file.filename}`;

    // NOTE (patch): status starts at "uploading", not "approved" — a file is
    // never visible/recommendable until the moderation callback (see
    // updateFileStatus below) explicitly approves it. This mirrors the real
    // AWS S3 -> Lambda -> Step Functions -> callback pipeline.
    const created = await FileModel.create({
      name: file.originalname,
      type: fileType,
      mimeType: file.mimetype,
      size: file.size,
      storagePath: file.path,
      publicUrl,
      storageProvider: "local",
      status: "uploading",
    });

    // Simulated async moderation walk: uploading -> scanning -> approved.
    // Real system: this step is owned by AWS and arrives via the callback
    // endpoint below. Kept here only so local/demo runs progress on their own.
    setTimeout(async () => {
      await FileModel.findByIdAndUpdate(created._id, { status: "scanning" });
    }, 500);

    setTimeout(async () => {
      await FileModel.findByIdAndUpdate(created._id, {
        status: "approved",
        moderatedAt: new Date(),
      });
      await embeddingQueue.add(
        "embedding",
        { fileId: (created._id as Types.ObjectId).toString() },
        {
          jobId: (created._id as Types.ObjectId).toString(),
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        },
      );
    }, 1500);

    return res.status(201).json({
      message: "Document uploaded successfully. Moderation in progress.",
      file: created,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
}

// PATCH /files/:id/status — simulates the AWS Step Functions moderation callback.
// This is the ONLY place file.status should ever be written from outside the
// embedding worker. Idempotent: same status twice is a no-op, not an error.
const VALID_STATUSES: FileStatus[] = ["uploading", "scanning", "approved", "rejected"];

export async function updateFileStatus(req: Request, res: Response) {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const { status } = req.body ?? {};

    if (!id) {
      return res.status(400).json({ error: "File id is required" });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const file = await FileModel.findById(id);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (file.status === status) {
      // Idempotent per spec — calling the callback twice with the same
      // status must not error or double-fire side effects (like re-queueing embeddings).
      return res.json({ success: true, file, unchanged: true });
    }

    const update: Record<string, unknown> = { status };
    if (status === "approved" || status === "rejected") {
      update.moderatedAt = new Date();
    }

    const updated = await FileModel.findByIdAndUpdate(id, update, { new: true });

    await LogModel.create({
      event: "moderation_completed",
      relatedFileId: updated!._id as Types.ObjectId,
      message: `status -> ${status}`,
    });

    // Embedding is computed once, at approval time — never on-demand during
    // a recommendation request. Rejected files are never queued.
    if (status === "approved" && !updated!.embedding) {
      await embeddingQueue.add(
        "embedding",
        { fileId: id },
        { jobId: id, attempts: 3, backoff: { type: "exponential", delay: 5000 } },
      );
    }

    return res.json({ success: true, file: updated });
  } catch (err) {
    console.error("updateFileStatus error:", err);
    return res.status(500).json({ error: "Failed to update file status" });
  }
}

// GET /files?status=approved&type=document
export async function getFiles(req: Request, res: Response) {
  try {
    const { type, admin, status: requestedStatus } = req.query;
    const isAdmin = admin === "true"; // TODO: replace with real auth/role check before production

    const where: Record<string, unknown> = {};
    if (type) where.type = type as string;

    if (isAdmin) {
      // Admins may filter by any status, including none (= all statuses).
      if (requestedStatus) where.status = requestedStatus as string;
    } else {
      // Never trust client-provided status for non-admin callers.
      where.status = "approved";
    }

    const files = await FileModel.find(where).sort({ createdAt: -1 });

    return res.json({ count: files.length, files });
  } catch (err) {
    console.error("Fetch files error:", err);
    return res.status(500).json({ error: "Failed to fetch files" });
  }
}

// GET /files/:id
export async function getFileById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { admin } = req.query;
    const isAdmin = admin === "true";

    const file = await FileModel.findById(id);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (!isAdmin && file.status !== "approved") {
      // Same response shape as "not found" — we don't want to leak the
      // existence/status of a rejected file to non-admin callers either.
      return res.status(404).json({ error: "File not found" });
    }

    return res.json({ file });
  } catch (err) {
    console.error("Fetch file error:", err);
    return res.status(500).json({ error: "Failed to fetch file" });
  }
}

// GET /files/:id/progress — fallback polling endpoint (in case SSE disconnects)
export async function getFileProgress(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const file = await FileModel.findById(id).select(
      "embeddingStatus totalChunks processedChunks status",
    );

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const total = file.totalChunks ?? 0;
    const processed = file.processedChunks ?? 0;
    const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

    return res.json({
      fileId: id,
      status: file.status,
      embeddingStatus: file.embeddingStatus,
      progress: progressPercent,
    });
  } catch (err) {
    console.error("Fetch progress error:", err);
    return res.status(500).json({ error: "Failed to fetch progress" });
  }
}

// DELETE /files/:id
export async function deleteFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const client = new MongoClient(process.env.MONGO_URI!);
    const collection = client
      .db(process.env.MONGODB_ATLAS_DB_NAME)
      .collection(process.env.MONGODB_ATLAS_COLLECTION_NAME as string);
    const file = await FileModel.findById(id);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    await collection.deleteMany({ fileId: id });
    await ChunkModel.deleteMany({ fileId: id });

    if (file.storagePath && fs.existsSync(file.storagePath)) {
      try {
        fs.unlinkSync(file.storagePath);
      } catch (fsErr: any) {
        console.error(`Physical file deletion failed for path ${file.storagePath}:`, fsErr.message);
      }
    }

    await FileModel.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "File, chunks, embeddings, and physical storage deleted successfully.",
    });
  } catch (err: any) {
    console.error("Delete file controller error:", err);
    return res.status(500).json({ error: "Failed to delete file and its embeddings" });
  }
}

export async function deleteProcessingFile(req: Request, res: Response) {
  const { id } = req.params;

  const file = await FileModel.findById(id);
  if (!file) {
    return res.status(404).json({ error: "Document not found in record." });
  }

  try {
    await FileModel.findByIdAndUpdate(id, { embeddingStatus: "failed", status: "rejected", moderatedAt: new Date() });

    const jobs = await embeddingQueue.getJobs(["waiting", "active", "delayed", "paused"]);
    const targetJob = jobs.find((job) => job.data.fileId === id);

    if (targetJob) {
      await targetJob.discard();
      await targetJob.remove();
    }

    const client = new MongoClient(process.env.MONGO_URI!);
    await client.connect();
    const collection = client.db(process.env.MONGODB_ATLAS_DB_NAME).collection(process.env.MONGODB_ATLAS_COLLECTION_NAME as string);

    await collection.deleteMany({ fileId: id });
    await ChunkModel.deleteMany({ fileId: id });
    await client.close();

    if (file.storagePath && fs.existsSync(file.storagePath)) {
      try {
        fs.unlinkSync(file.storagePath);
      } catch (fsErr: any) {
        console.error(`Physical local storage unlinking failed:`, fsErr.message);
      }
    }

    await FileModel.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "Processing pipeline terminated and purged successfully.",
    });
  } catch (queueErr: any) {
    console.error("Failed to safely truncate BullMQ active state task:", queueErr.message);
    return res.status(500).json({ error: "Failed to abort processing completely." });
  }
}
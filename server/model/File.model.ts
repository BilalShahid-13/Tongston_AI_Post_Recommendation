import mongoose, { Schema, Document } from "mongoose";

export type FileCategory = "image" | "video" | "audio" | "document";
export type FileStatus = "uploading" | "scanning" | "approved" | "rejected";

export interface IFile extends Document {
  name: string;               // originalname shown to users
  type: FileCategory;
  mimeType: string;
  size: number;
  storagePath: string;
  publicUrl: string;
  storageProvider: "local" | "s3";
  status: FileStatus;
  tags: string[];
  captionText?: string;       // image/video/audio description used for retrieval
  extractedText?: string;     // document text used for retrieval
  embedding?: number[];       // computed ONCE at approval time — never per-request
  embeddedAt?: Date;
  embeddingStatus?: "pending" | "processing" | "completed" | "failed";
  totalChunks?: number;
  processedChunks?: number;
  uploadedBy?: string;
  moderatedAt?: Date;
  createdAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["image", "video", "audio", "document"], required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
    publicUrl: { type: String, required: true },
    storageProvider: { type: String, enum: ["local", "s3"], default: "local" },
    // Hardcode default to a non-visible state; nothing should assume "approved" by default.
    status: {
      type: String,
      enum: ["uploading", "scanning", "approved", "rejected"],
      default: "uploading",
      index: true,
    },
    tags: { type: [String], default: [] },
    captionText: { type: String },
    extractedText: { type: String },
    embedding: { type: [Number], default: undefined },
    embeddedAt: { type: Date },
    embeddingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    totalChunks: { type: Number, default: 0 },
    processedChunks: { type: Number, default: 0 },
    uploadedBy: { type: String },
    moderatedAt: { type: Date },
  },
  { timestamps: true }
);

// Belt-and-suspenders: index used by every approved-only query in the app.
FileSchema.index({ status: 1, type: 1 });

export const FileModel = mongoose.model<IFile>("File", FileSchema);
export interface FileRecord {
  _id: string;
  name: string;
  type: string;
  publicUrl: string;
  status: "uploading" | "scanning" | "approved" | "rejected";
  embeddingStatus: "pending" | "processing" | "completed" | "failed";
  totalChunks: number;
  processedChunks: number;
  createdAt: string;
}
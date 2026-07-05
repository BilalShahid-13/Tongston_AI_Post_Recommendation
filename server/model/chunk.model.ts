import mongoose, { Schema, Document, Types } from "mongoose";

export interface IChunk extends Document {
  fileId: Types.ObjectId;
  chunkIndex: number;
  text: string;
  embedding: number[];
  createdAt: Date;
}

const chunkSchema = new Schema<IChunk>(
  {
    fileId: { type: Schema.Types.ObjectId, ref: "File", required: true, index: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

export const ChunkModel = mongoose.model<IChunk>("Chunk", chunkSchema);
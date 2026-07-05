import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPostVariant {
  content: string;
  hashtags: string[];
}

export type PostStatus = 'draft' | 'generated' | 'accepted';

export interface IPost extends Document {
  userId?: Types.ObjectId;
  promptInput: string;
  variants: IPostVariant[];
  generationHistory: string[]; 
  finalContent?: string;
  finalHashtags: string[];
  status: PostStatus;
  attachedFiles: Types.ObjectId[];
  modelUsed?: string;
  embedding?: number[];

  createdAt: Date;
  updatedAt: Date;
}

const postVariantSchema = new Schema<IPostVariant>(
  {
    content: { type: String, required: true },
    hashtags: { type: [String], default: [] },
  },
  { _id: false }
);

const postSchema = new Schema<IPost>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    promptInput: { type: String, required: true },
    variants: { type: [postVariantSchema], default: [] },
    generationHistory: { type: [String], default: [] }, // New track array to support fresh re-rolls
    finalContent: { type: String },
    finalHashtags: { type: [String], default: [] }, // Dedicated placeholder for final accepted tags
    status: {
      type: String,
      enum: ['draft', 'generated', 'accepted'],
      default: 'draft',
      index: true,
    },
    attachedFiles: [{ type: Schema.Types.ObjectId, ref: 'File' }],
    embedding: { type: [Number], default: undefined },
    modelUsed: { type: String },
  },
  { timestamps: true }
);

export const PostModel = mongoose.model<IPost>('Post', postSchema);
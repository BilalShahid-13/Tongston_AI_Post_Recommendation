import mongoose, { Schema, Document, Types } from 'mongoose';

export type LogEvent =
  | 'ai_request'
  | 'ai_success'
  | 'ai_failure'
  | 'ai_timeout'
  | 'embedding_job_started'
  | 'embedding_job_completed'
  | 'embedding_job_failed'
  | 'moderation_completed'
  | 'recommendation_fallback'
  | 'recommendation_request'
  | 'recommendation_success'
  | 'recommendation_failure'
  | 'hashtags_saved_successfully'
  | 'post_saved_to_db';

export type LogType = 'post-generation' | 'media-recommendation' | 'hashtag-suggestion';

export interface ILog extends Document {
  event: LogEvent;
  type?: LogType;          // operational category, used by the GenerationLog reporting queries
  requestId?: string;      // ties this row back to a single HTTP request, set by requestId middleware
  provider?: string;       // which model/provider served this call (or "fallback")
  latencyMs?: number;
  success?: boolean;
  relatedFileId?: Types.ObjectId;
  relatedPostId?: Types.ObjectId;
  message?: string;        // short summary only — never full raw AI output, keeps logs lean
  meta?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const logSchema = new Schema<ILog>(
  {
    event: {
      type: String,
      enum: [
        'ai_request',
        'ai_success',
        'ai_failure',
        'ai_timeout',
        'embedding_job_started',
        'embedding_job_completed',
        'embedding_job_failed',
        'moderation_completed',
        'recommendation_fallback',
        'recommendation_request',
        'recommendation_success',
        'recommendation_failure',
        'hashtags_saved_successfully', // 👈 Mongoose Validation Array mein add kiya
        'post_saved_to_db',             // 👈 Mongoose Validation Array mein add kiya
      ],
      required: true,
    },
    type: { type: String, enum: ['post-generation', 'media-recommendation', 'hashtag-suggestion'] },
    requestId: { type: String, index: true },
    provider: { type: String },
    latencyMs: { type: Number },
    success: { type: Boolean },
    relatedFileId: { type: Schema.Types.ObjectId, ref: 'File' },
    relatedPostId: { type: Schema.Types.ObjectId, ref: 'Post' },
    message: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const LogModel = mongoose.model<ILog>('Log', logSchema);
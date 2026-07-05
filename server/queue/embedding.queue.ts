import { Queue, QueueEvents } from "bullmq";
import { connection } from "../config/redis.config";

export const embeddingQueue = new Queue("embedding", {
  connection: connection,
});

// QueueEvents listens globally to ALL jobs' progress — this is what powers SSE
export const embeddingQueueEvents = new QueueEvents("embedding", {
  connection: connection,
});

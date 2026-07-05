import { vectorStore } from "@/services/embedding.service";
import { tool } from "@langchain/core/tools";
import * as z from "zod";

const retrieveSchema = z.object({
  query: z.string(),
});

export const retrieve = tool(
  async ({ query }) => {
    const docs = await vectorStore.similaritySearchWithScore(query, 10);

    console.log("Retrieved:");
    console.log("====================================");
    docs.forEach(([doc, score], i) => {
      console.log(`Result ${i}`);
      console.log("Score:", score);
      console.log("Chunk:", doc.metadata.chunkIndex);
      console.log(doc.pageContent);
      console.log("------------------------------------");
    });

    // const filtered = docs
    //   .filter(([_, score]) => score < 0.4)
    //   .map(([doc]) => doc);
    const filtered = docs.map(([doc]) => doc);

    console.log("Filtered:", filtered.length);

    const serialized = filtered
      .map(
        (doc) => `File ID: ${doc.metadata.fileId}
Chunk: ${doc.metadata.chunkIndex}

${doc.pageContent}`
      )
      .join("\n\n-----------------\n\n");

    console.log(serialized);

    return [serialized, filtered];
  },
  {
    name: "retrieve",
    description:
      "Retrieve contextually relevant document chunks and text sections from the knowledge base related to the user's query.",
    schema: retrieveSchema,
    responseFormat: "content_and_artifact",
  }
);
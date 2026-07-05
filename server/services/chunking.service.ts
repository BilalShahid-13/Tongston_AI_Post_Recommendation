import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", ". ", " ", ""],
});

export async function chunkText(text: string): Promise<string[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot chunk empty text");
  }
  return splitter.splitText(text);
}

export async function* chunkTextStream(text: string): AsyncGenerator<string, void, unknown> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot chunk empty text");
  }

  const chunks = await splitter.splitText(text);
  for (const chunk of chunks) {
    yield chunk; // Yeh ek ek karke data return karega bina memory fill kiye
  }
}

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fs from "fs";

export async function extractTextFromFile(
  filePath: string,
  mimeType: string,
): Promise<string> {
  if (mimeType === "application/pdf") {
    const loader = new PDFLoader(filePath, { splitPages: false });
    const docs = await loader.load();

    const fullText = docs.map((doc) => doc.pageContent).join("\n\n");

    if (!fullText || fullText.trim().length === 0) {
      throw new Error(
        "PDF appears to be empty or unreadable (possibly scanned/image-based)",
      );
    }

    return fullText;
  }

  if (mimeType === "text/plain") {
    return fs.readFileSync(filePath, "utf-8");
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Unsupported mime type for text extraction: ${mimeType}`);
}

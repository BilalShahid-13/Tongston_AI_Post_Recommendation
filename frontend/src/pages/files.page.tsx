import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { FileList } from "@/components/FileList";

export function FilesPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleUploadSuccess() {
    setRefreshTrigger((prev) => prev + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Files & Docs</h1>
        <p className="text-muted-foreground text-sm">
          Upload images, videos, audio, and documents. Only approved files are
          available for use in posts.
        </p>
      </div>

      <FileUpload onUploadSuccess={handleUploadSuccess} />
      <FileList refreshTrigger={refreshTrigger} />
    </div>
  );
}
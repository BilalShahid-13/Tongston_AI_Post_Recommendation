const BASE_URL = "http://localhost:3000";

export async function uploadFile(file: File): Promise<{ file: FileRecordResponse }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/files/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Upload failed");
  }

  return res.json();
}

export async function getFiles() {
  const res = await fetch(`${BASE_URL}/files`);
  if (!res.ok) throw new Error("Failed to fetch files");
  return res.json();
}

export async function deleteFileById(id: string) {
  const res = await fetch(`${BASE_URL}/files/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to delete file");
  }

  return res.json();
}


export async function cancelAndDeleteProcessingFile(id: string) {
  const res = await fetch(`${BASE_URL}/files/inProcessing/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to abort the processing file");
  }

  return res.json();
}

interface FileRecordResponse {
  _id: string;
  name: string;
  type: string;
  status: string;
}

export { BASE_URL };
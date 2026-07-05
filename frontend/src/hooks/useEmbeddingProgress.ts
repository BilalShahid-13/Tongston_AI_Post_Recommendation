import { useEffect, useState } from "react";
import { BASE_URL } from "../api";

interface ProgressData {
  progress: number | null;
  completed: boolean;
  error?: string;
}

export function useEmbeddingProgress(fileId: string | null) {
  const [data, setData] = useState<ProgressData>({ progress: null, completed: false });

  useEffect(() => {
    if (!fileId) return;

    const eventSource = new EventSource(`${BASE_URL}/sse/embedding-progress/${fileId}`);

    eventSource.onmessage = (e) => {
      const parsed = JSON.parse(e.data);

      if (parsed.error) {
        setData({ progress: null, completed: false, error: parsed.error });
        eventSource.close();
        return;
      }

      if (parsed.progress === 100) {
        setData({ progress: 100, completed: true });
        eventSource.close();
        return;
      }

      if (typeof parsed.progress === "number") {
        setData({ progress: parsed.progress, completed: false });
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [fileId]);

  return data;
}
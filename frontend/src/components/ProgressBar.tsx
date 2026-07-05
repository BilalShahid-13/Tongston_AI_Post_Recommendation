import { useEmbeddingProgress } from "../hooks/useEmbeddingProgress";

interface Props {
  fileId: string;
}

export function ProgressBar({ fileId }: Props) {
  const { progress, completed, error } = useEmbeddingProgress(fileId);

  if (error) {
    return <p style={{ color: "red", fontSize: "13px" }}>Embedding failed: {error}</p>;
  }

  if (completed) {
    return <p style={{ color: "green", fontSize: "13px" }}>✅ Embedding complete</p>;
  }

  const percent = progress ?? 0;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: "#eee", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
        <div
          style={{
            width: `${percent}%`,
            background: "#4f46e5",
            height: "100%",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: "12px", color: "#666" }}>{percent}%</span>
    </div>
  );
}
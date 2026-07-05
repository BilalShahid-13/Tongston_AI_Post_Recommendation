import { Progress } from "@/components/ui/progress"
import { useEmbeddingProgress } from "@/hooks/useEmbeddingProgress";

interface Props {
  fileId: string;
}

export function ProgressBar({ fileId }: Props) {
  // 🚀 Real SSE stream state handling from your custom hook
  const { progress, completed, error } = useEmbeddingProgress(fileId);

  // Dynamic state message generation based on live chunking progress percentages
  const getStatusMessage = (currentProgress: number) => {
    if (error) return "⚠️ Embedding generation failed!";
    if (completed || currentProgress >= 100) return "✅ Complete! Ready for recommendations.";
    
    if (currentProgress === 0) return "Starting document extraction...";
    if (currentProgress < 15) return "Reading document text content...";
    if (currentProgress < 30) return "Splitting text streams into recursive chunks...";
    if (currentProgress < 50) return "Generating semantic vectors via Ollama cluster...";
    if (currentProgress < 85) return "Streaming vectorized metadata payloads to MongoDB...";
    if (currentProgress < 100) return "Finalizing vector index pipeline validation...";
    
    return "Processing document vectors...";
  };

  // Safe boundaries setup for progress visualization rendering
  const displayProgress = error ? 100 : Math.min(Math.round(progress || 0), 100);

  return (
    <div className="w-full space-y-1.5 pt-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {error ? "Processing Error" : "Vector Embedding Pipeline"}
        </span>
        <span className={`text-xs font-bold ${error ? "text-destructive" : "text-slate-600 dark:text-slate-400"}`}>
          {displayProgress}%
        </span>
      </div>
      
      {/* Shadcn UI progress bar component */}
      <Progress 
        value={displayProgress} 
        className={`h-2 transition-all ${error ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
      />
      
      <div className={`text-[11px] font-medium transition-colors ${
        error 
          ? "text-destructive dark:text-destructive" 
          : completed 
            ? "text-emerald-600 dark:text-emerald-400" 
            : "text-slate-500 dark:text-slate-400"
      }`}>
        {getStatusMessage(displayProgress)}
      </div>
    </div>
  );
}
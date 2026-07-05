import { cancelAndDeleteProcessingFile, deleteFileById } from "@/api";
import { ProgressBar } from "@/components/examples/c-progress-4";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { FileRecord } from "@/types";
import {
    AlertTriangle,
    AudioLines,
    CheckCircle2,
    Clock,
    FileCode,
    FileText,
    Image as ImageIcon,
    Loader2,
    OctagonX,
    Trash2,
    Video
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { Badge } from "./reui/badge";
import { Button } from "./ui/button";
import { uploadStore } from "@/store/UploadStore.store";

const getFileIcon = (mimeType: string, type: string) => {
    const lowerMime = mimeType?.toLowerCase() || "";
    const lowerType = type?.toLowerCase() || "";

    if (lowerMime.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    if (lowerMime.includes("word") || lowerMime.includes("officedocument.wordprocessingml")) {
        return <FileText className="h-5 w-5 text-blue-500" />;
    }
    if (lowerType === "audio" || lowerMime.includes("audio")) return <AudioLines className="h-5 w-5 text-purple-500" />;
    if (lowerType === "video" || lowerMime.includes("video")) return <Video className="h-5 w-5 text-indigo-500" />;
    if (lowerType === "image" || lowerMime.includes("image")) return <ImageIcon className="h-5 w-5 text-emerald-500" />;

    return <FileCode className="h-5 w-5 text-slate-500" />;
};

const getStatusBadgeVariant = (status: FileRecord["status"]) => {
    switch (status) {
        case "approved":
            return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900";
        case "scanning":
        case "uploading":
            return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900";
        case "rejected":
            return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900";
        default:
            return "bg-slate-50 text-slate-700 border-slate-200";
    }
};

export default function ListCard({
    _id,
    createdAt,
    embeddingStatus,
    name,
    status,
    type,
    publicUrl,
    mimeType
}: FileRecord & { mimeType?: string }) {

    const [isDeleting, setIsDeleting] = useState(false);
    const [isAborting, setIsAborting] = useState(false);
    const { mutate } = useSWRConfig();

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();

        setIsDeleting(true);

        try {
            // 1. Backend par delete request bhejein
            await deleteFileById(_id);

            toast.success("Deleted successfully", {
                description: `"${name}" has been wiped out from the system.`,
            });

            // mutate((key) => typeof key === "string" && key.includes("/files"));
            await mutate(
                (key) => Array.isArray(key) && key[0] === "files",
                undefined,
                { revalidate: true }
            );
            uploadStore.clearHistory()

        } catch (err: any) {
            toast.error("Deletion failed", {
                description: err.message || "Something went wrong while executing query.",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAbortPipeline = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Event bubbles prevent karein

        const confirmAbort = confirm(
            `Warning: "${name}" is currently in queue. Do you want to stop the embedding process and remove all its fragments completely?`
        );
        if (!confirmAbort) return;

        setIsAborting(true);

        // Initial feedback toast to user
        toast.info("Stopping queue worker and cleaning databases...");

        try {
            // 1. Backend Controller Pipeline Hit
            await cancelAndDeleteProcessingFile(_id);

            // 2. Successful Execution Notification Trigger
            toast.success("Pipeline Stopped!", {
                description: `"${name}" embedding worker killed. Incomplete data successfully purged.`,
            });

            await mutate(
                (key) => Array.isArray(key) && key[0] === "files",
                undefined,
                { revalidate: true }
            );
            uploadStore.clearHistory()

        } catch (err: any) {
            console.error(err);
            toast.error("Abort Failed", {
                description: err.message || "Failed to stop active worker processing.",
            });
        } finally {
            setIsAborting(false);
        }
    };

    const isProcessingNow =
        status === "scanning" ||
        embeddingStatus === "pending" ||
        embeddingStatus === "processing";

    // If it's NOT running, then it's static (ready for full clean delete button)
    const isNotRunning = !isProcessingNow;

    return (
        <Card className="mb-3 overflow-hidden border border-slate-200/80 transition-all hover:shadow-sm dark:border-slate-800">
            <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                        {/* Dynamic Document/Media Type Icon */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-900">

                            {mimeType?.includes('image') ?
                                <img className="w-full h-full object-cover"
                                    src={publicUrl} /> :
                                getFileIcon(mimeType || "", type)
                            }
                        </div>

                        <div className="overflow-hidden">
                            <CardTitle className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                                {name}
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
                                <p>
                                    {type.toUpperCase()} • {new Date(createdAt).toLocaleString()}
                                </p>
                                <div className="flex items-center gap-2 shrink-0">

                                    {/* CASE A: File Queue me RUNNING hai -> Show Abort/Stop Button */}
                                    {isProcessingNow && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleAbortPipeline}
                                            disabled={isAborting}
                                            className="h-8 text-[11px] border-amber-200 hover:bg-amber-50 text-amber-700 hover:text-amber-800 dark:border-amber-900/50 dark:hover:bg-amber-950/20"
                                        >
                                            {isAborting ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                    <span>Stopping...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <OctagonX className="h-3 w-3 mr-1 text-amber-500" />
                                                    <span>Stop Queue & Delete</span>
                                                </>
                                            )}
                                        </Button>
                                    )}

                                    {/* CASE B: File RUNNING NAHI hai -> Show standard full Delete Button */}
                                    {isNotRunning && (
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            className="h-8 text-[11px] font-medium"
                                        >
                                            {isDeleting ? (
                                                <div className="flex flex-row gap-1.5 justify-center items-center">
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    <span>Deleting</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-row gap-1.5 justify-center items-center">
                                                    <Trash2 className="h-3 w-3" />
                                                    <span>Delete</span>
                                                </div>
                                            )}
                                        </Button>
                                    )}

                                </div>
                            </CardDescription>
                        </div>
                    </div>

                    {/* File General Lifecycle Status */}
                    <Badge className={`border px-2 py-0.5 text-[11px] font-medium shadow-none capitalize ${getStatusBadgeVariant(status)}`}>
                        {status}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 pt-1">
                {/* Embedded Progress Conditional Layout States */}
                {embeddingStatus === "processing" && (
                    <div className="mt-2 rounded-md bg-slate-50/50 p-2 dark:bg-slate-900/40">
                        <ProgressBar fileId={_id} />
                    </div>
                )}

                {embeddingStatus === "completed" && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success dark:text-success">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Ready for recommendations</span>
                    </div>
                )}

                {embeddingStatus === "failed" && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive dark:text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Embedding failed</span>
                    </div>
                )}

                {embeddingStatus === "pending" && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <Clock className="h-4 w-4 animate-pulse" />
                        <span>In queue...</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
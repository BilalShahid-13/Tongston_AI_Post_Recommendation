"use client"

import { observer } from "mobx-react-lite"
import { uploadStore } from "@/store/UploadStore.store"
import { FileThumbnail } from "./FileThumbnail"
import { useFileUpload, formatBytes, type FileWithPreview } from "@/hooks/use-file-upload"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/reui/badge"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { UploadCloud, X, AlertCircle, RotateCcw, Upload } from "lucide-react"

interface ProgressUploadProps {
  maxFiles?: number
  maxSize?: number
  accept?: string
  multiple?: boolean
  className?: string
  onFilesChange?: (files: FileWithPreview[]) => void
  onUploadSuccess?: (fileId: string) => void
}

export const FileUpload = observer(({
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024,
  accept = ".pdf,.txt,.docx,.jpg,.jpeg,.png,.webp",
  multiple = true,
  className,
  onFilesChange,
  onUploadSuccess,
}: ProgressUploadProps) => {

  const [
    { isDragging, errors },
    { removeFile, clearFiles, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, getInputProps },
  ] = useFileUpload({
    maxFiles,
    maxSize,
    accept,
    multiple,
    initialFiles: [],
    onFilesChange: (newFiles) => {
      // 🚀 Sync seamlessly with MobX Global store instance
      uploadStore.setFiles(newFiles)
      onFilesChange?.(newFiles)
    },
  })

  const removeUploadFile = (fileId: string) => {
    uploadStore.removeUploadFile(fileId)
    removeFile(fileId)
  }

  const { completedCount, errorCount, uploadingCount, idleCount, hasQueuedOrError } = uploadStore.metrics

  return (
    <div className={cn("w-full", className)}>
      {/* Dropzone Container */}
      <div
        className={cn(
          "rounded-lg relative border border-dashed p-8 text-center transition-colors cursor-pointer",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input {...getInputProps()} className="sr-only" />
        <div className="flex flex-col items-center gap-4">
          <div className={cn("flex h-16 w-16 items-center justify-center rounded-full", isDragging ? "bg-primary/10" : "bg-muted")}>
            <UploadCloud className={cn("h-6 w-6", isDragging ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Select your document files</h3>
            <p className="text-muted-foreground text-xs">Drag and drop files here or click to browse</p>
            <p className="text-muted-foreground text-[11px]">Accepts PDF, DOCX, TXT up to {formatBytes(maxSize)}</p>
          </div>
        </div>
      </div>

      {/* MobX Metrics Stats Bar */}
      {uploadStore.uploadFiles.length > 0 && (
        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Progress States</h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              {idleCount > 0 && <Badge size="sm" variant="secondary">Queued: {idleCount}</Badge>}
              {completedCount > 0 && <Badge size="sm" variant="success-light">Loaded: {completedCount}</Badge>}
              {errorCount > 0 && <Badge size="sm" variant="destructive">Errors: {errorCount}</Badge>}
              {uploadingCount > 0 && <Badge size="sm" variant="secondary" className="animate-pulse">Uploading: {uploadingCount}</Badge>}
            </div>
          </div>
          <Button onClick={() => { uploadStore.clearHistory(); clearFiles(); }} variant="outline" size="sm" className="h-7 text-xs">Clear history</Button>
        </div>
      )}

      {/* Streaming Map List with Structural Custom Thumbnails */}


      {/* grid */}
      {uploadStore.uploadFiles.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {uploadStore.uploadFiles.map((fileItem) => (
            <div
              key={fileItem.id}
              className="group/item relative aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            >
              {/* 🎨 DYNAMIC CANVAS/IMAGE THUMBNAIL (Fills the entire card square layout) */}
              <div className="absolute inset-0 h-full w-full flex items-center justify-center">
                <FileThumbnail file={fileItem.file} preview={fileItem.preview} />
              </div>

              {/* 🎚️ DARK OVERLAY LAYER (Sirf hover karne par visible hoga text readability ke liye) */}
              <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-200 group-hover/item:opacity-100" />

              {/* ❌ TOP-RIGHT: CLOSE BUTTON */}
              <div className="absolute top-2 right-2 z-10 opacity-0 transition-opacity duration-200 group-hover/item:opacity-100">
                <Button
                  onClick={(e) => { e.stopPropagation(); removeUploadFile(fileItem.id); }}
                  variant="destructive"
                  size="icon"
                  className="h-6 w-6 rounded-full shadow-md bg-rose-600 hover:bg-rose-700 text-white border-none"
                >
                  <X className="size-3.5" />
                </Button>
              </div>

              {/* 📊 CENTER: FILE SIZE & STATUS ACTIONS */}
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none opacity-0 transition-opacity duration-200 group-hover/item:opacity-100 text-white px-2">
                <span className="text-xs font-bold bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-[2px]">
                  {formatBytes(fileItem.file.size)}
                </span>

                {/* Status logs container inside center card overlay */}
                <div className="mt-1 font-semibold text-[10px] text-center">
                  {fileItem.status === "idle" && <span className="text-amber-300">Ready</span>}
                  {fileItem.status === "completed" && <span className="text-emerald-400">Saved</span>}
                  {fileItem.status === "uploading" && (
                    <div className="w-16 mt-1 pointer-events-auto">
                      <Progress value={fileItem.progress} className="h-1 bg-white/20" />
                    </div>
                  )}
                </div>
              </div>

              {/* 📝 BOTTOM-LEFT: FILE NAME TITLE */}
              <div className="absolute bottom-0 inset-x-0 p-2 z-10 pointer-events-none opacity-0 transition-opacity duration-200 group-hover/item:opacity-100 bg-gradient-to-t from-black/80 to-transparent">
                <p className="truncate text-[11px] font-medium text-white">
                  {fileItem.file.name}
                </p>
              </div>

              {/* ⚠️ ABSOLUTE ERROR BANNER HANDLING */}
              {fileItem.status === "error" && fileItem.error && (
                <div className="absolute inset-0 bg-rose-950/90 z-20 p-2 flex flex-col items-center justify-center text-center gap-1.5 text-white">
                  <AlertCircle className="size-4 text-rose-400 animate-bounce" />
                  <span className="text-[10px] font-medium leading-tight max-line-clamp-2 px-1">
                    {fileItem.error}
                  </span>
                  <Button
                    onClick={(e) => { e.stopPropagation(); uploadStore.processNativeServerUpload(fileItem, onUploadSuccess); }}
                    variant="secondary"
                    size="sm"
                    className="h-6 text-[10px] px-2 py-0"
                  >
                    <RotateCcw className="size-3 mr-1" /> Retry
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Batch Execute Action Control */}
      {hasQueuedOrError && (
        <Button
          onClick={() => uploadStore.handleBatchUploadClick(onUploadSuccess)}
          className="w-full mt-4 gap-2 font-semibold shadow-sm"
          disabled={uploadingCount > 0}
        >
          <Upload className="h-4 w-4" />
          {uploadingCount > 0 ? "Uploading Documents..." : `Upload ${idleCount + errorCount} Document File(s)`}
        </Button>
      )}

      {errors.length > 0 && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="size-4" />
          <AlertTitle className="text-xs font-bold">File restriction policy alerts</AlertTitle>
          <AlertDescription className="text-[11px] mt-1">
            {errors.map((error, index) => <p key={index}>{error}</p>)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
})
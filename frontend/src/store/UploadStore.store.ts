import {
    type FileWithPreview
} from "@/hooks/use-file-upload";
import { makeAutoObservable } from "mobx";
import { uploadFile } from "../api";

export interface MobXUploadItem extends FileWithPreview {
    progress: number
    status: "idle" | "uploading" | "completed" | "error"
    error?: string
}

class UploadStore {
    uploadFiles: MobXUploadItem[] = []

    constructor() {
        makeAutoObservable(this)
    }

    // Files Queue inside local reactive cache array
    setFiles(newFiles: FileWithPreview[]) {
        this.uploadFiles = newFiles.map((file) => {
            const existingFile = this.uploadFiles.find((existing) => existing.id === file.id)
            if (existingFile) return { ...existingFile, ...file }
            return {
                ...file,
                progress: 0,
                status: "idle" as const,
            }
        })
    }

    // Complete Eviction logic (Called automatically when list items are removed or aborted)
    removeUploadFile(fileId: string) {
        this.uploadFiles = this.uploadFiles.filter((file) => file.id !== fileId)
    }

    clearHistory() {
        this.uploadFiles = []
    }

    // Network Trigger Core Actions mapping
    async processNativeServerUpload(fileItem: MobXUploadItem, onUploadSuccess?: (fileId: string) => void) {
        if (fileItem.status === "completed" || fileItem.status === "uploading") return

        try {
            this.updateFileStatus(fileItem.id, "uploading", 45)
            const result = await uploadFile(fileItem.file)
            this.updateFileStatus(fileItem.id, "completed", 100)

            if (result?.file?._id && onUploadSuccess) {
                onUploadSuccess(result.file._id)
            }
        } catch (err: any) {
            const msg = err?.message || "Upload failed. Please try again."
            this.setFileError(fileItem.id, msg)
        }
    }

    async handleBatchUploadClick(onUploadSuccess?: (fileId: string) => void) {
        const pendingFiles = this.uploadFiles.filter(f => f.status === "idle" || f.status === "error")
        await Promise.all(pendingFiles.map(file => this.processNativeServerUpload(file, onUploadSuccess)))
    }

    // Internal structural modifiers (Required for MobX strict mode mutations)
    private updateFileStatus(id: string, status: MobXUploadItem["status"], progress: number) {
        const file = this.uploadFiles.find(f => f.id === id)
        if (file) {
            file.status = status
            file.progress = progress
            file.error = undefined
        }
    }

    private setFileError(id: string, errorMessage: string) {
        const file = this.uploadFiles.find(f => f.id === id)
        if (file) {
            file.status = "error"
            file.error = errorMessage
        }
    }

    // Computed state metrics getters
    get metrics() {
        return {
            completedCount: this.uploadFiles.filter((f) => f.status === "completed").length,
            errorCount: this.uploadFiles.filter((f) => f.status === "error").length,
            uploadingCount: this.uploadFiles.filter((f) => f.status === "uploading").length,
            idleCount: this.uploadFiles.filter((f) => f.status === "idle").length,
            hasQueuedOrError: this.uploadFiles.some(f => f.status === "idle" || f.status === "error")
        }
    }
}

export const uploadStore = new UploadStore()
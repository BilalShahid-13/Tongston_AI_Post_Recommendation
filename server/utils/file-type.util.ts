export type SupportedFileType = "document" | "image" | "video" | "audio";

const MIME_TYPE_MAP: Record<string, SupportedFileType> = {
    // Documents
    "application/pdf": "document",
    "text/plain": "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",

    // Images
    "image/jpeg": "image",
    "image/png": "image",
    "image/webp": "image",

    "video/mp4": "video",
    "video/quicktime": "video", // .mov
    "video/x-msvideo": "video", // .avi

    // Audio
    "audio/mpeg": "audio", // .mp3
    "audio/wav": "audio",
    "audio/x-wav": "audio",
};

export function getFileTypeFromMime(mimeType: string): SupportedFileType | null {
    return MIME_TYPE_MAP[mimeType] ?? null;
}

export function isAllowedMimeType(mimeType: string): boolean {
    return mimeType in MIME_TYPE_MAP;
}
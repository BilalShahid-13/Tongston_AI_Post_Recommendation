import ffmpeg from "fluent-ffmpeg";

export interface MediaMetadata {
    duration?: number; // seconds
    format?: string;
    bitrate?: number;
    width?: number;
    height?: number;
    codec?: string;
    sampleRate?: number;
}

export function extractMediaMetadata(filePath: string): Promise<MediaMetadata> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) {
                return reject(new Error(`Metadata extraction failed: ${err.message}`));
            }

            const videoStream = data.streams.find((s) => s.codec_type === "video");
            const audioStream = data.streams.find((s) => s.codec_type === "audio");

            resolve({
                duration: data.format.duration,
                format: data.format.format_name,
                bitrate: data.format.bit_rate ? Number(data.format.bit_rate) : undefined,
                width: videoStream?.width,
                height: videoStream?.height,
                codec: videoStream?.codec_name || audioStream?.codec_name,
                sampleRate: audioStream?.sample_rate ? Number(audioStream.sample_rate) : undefined,
            });
        });
    });
}

/**
 * Metadata ko ek readable text mein convert karta hai — taake embed kar sakein
 */
export function metadataToText(fileName: string, type: "video" | "audio", meta: MediaMetadata): string {
    const parts: string[] = [`File: ${fileName}`, `Type: ${type}`];

    if (meta.duration) parts.push(`Duration: ${Math.round(meta.duration)} seconds`);
    if (meta.format) parts.push(`Format: ${meta.format}`);
    if (meta.width && meta.height) parts.push(`Resolution: ${meta.width}x${meta.height}`);
    if (meta.codec) parts.push(`Codec: ${meta.codec}`);
    if (meta.bitrate) parts.push(`Bitrate: ${Math.round(meta.bitrate / 1000)} kbps`);
    if (meta.sampleRate) parts.push(`Sample Rate: ${meta.sampleRate} Hz`);

    return parts.join(", ");
}
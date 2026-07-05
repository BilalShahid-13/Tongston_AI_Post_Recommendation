import { getFiles } from "@/api";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { FileRecord } from "@/types";
import {
    AlertCircle,
    Hash,
    ImagePlus,
    Loader2,
    Sparkles,
    X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    generatePost,
    regeneratePost,
    editPost,
    acceptPost,
    recommendMedia,
    suggestHashtags,
    type MediaRecommendation
} from "@/api/ai";

const CATEGORIES = ["all", "image", "video", "audio", "document"] as const;

export function CreatePostPage() {
    // --- generation state ---
    const [prompt, setPrompt] = useState("");
    const [content, setContent] = useState("");
    const [tone, setTone] = useState(""); // Tone state support if needed
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);

    // --- hashtags ---
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [isLoadingHashtags, setIsLoadingHashtags] = useState(false);

    // --- asset picker ---
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [approvedFiles, setApprovedFiles] = useState<FileRecord[]>([]);
    const [recommendedFiles, setRecommendedFiles] = useState<MediaRecommendation[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [isLoadingRecommend, setIsLoadingRecommend] = useState(false);
    const [recommendNote, setRecommendNote] = useState<string | null>(null);
    const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
    const [attachedFiles, setAttachedFiles] = useState<FileRecord[]>([]);
    const [generatedPostId, setGeneratedPostId] = useState<string | null>("");

    useEffect(() => {
        setGeneratedPostId("");
        setSuggestions([]);
        setHashtags([]);
    }, [prompt, tone]);
    useEffect(() => {
        if (!content.trim() || content.trim().length < 5) {
            setRecommendedFiles([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoadingRecommend(true);
            setRecommendNote(null);
            try {
                const { recommendations } = await recommendMedia(content.trim());
                if (!recommendations.length) {
                    setRecommendNote("No close matches found in your approved files.");
                    setRecommendedFiles([]);
                } else {
                    setRecommendedFiles(recommendations);
                }
            } catch {
                setRecommendNote("AI recommendations are unavailable right now.");
                setRecommendedFiles([]);
            } finally {
                setIsLoadingRecommend(false);
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [content]);

    const handleTextareaChange = async (val: string) => {
        setContent(val);
        if (generatedPostId && val.trim().length > 0) {
            try {
                await editPost(generatedPostId, val.trim());
            } catch (e) {
                console.error("Failed to sync custom draft changes to cloud repository.", e);
            }
        }
    };

    // 🚀 INITIAL OR REGENERATE GENERATION MANAGER
    async function handleGenerateOrRegenerate() {
        if (prompt.trim().length < 3) {
            setGenerateError("Add a topic or a few words first (min 3 characters).");
            return;
        }
        setGenerateError(null);
        setIsGenerating(true);
        try {
            let data;
            if (generatedPostId) {
                data = await regeneratePost(generatedPostId, tone);
            } else {
                data = await generatePost(prompt.trim(), tone);
            }

            if (!data.variations?.length) {
                setGenerateError("AI couldn't generate variations. Try rephrasing.");
                return;
            }
            if (data.usedFallback) {
                toast.info("Showing reliable system safety placeholders due to AI latency.");
            }
            setGeneratedPostId(data.postId);
            setSuggestions(data.variations);
        } catch (err: any) {
            setGenerateError(err?.message || "AI engine service currently offline.");
        } finally {
            setIsGenerating(false);
        }
    }

    function useSuggestion(text: string) {
        setContent(text);
        if (generatedPostId) {
            editPost(generatedPostId, text);
        }
    }

    // #️⃣ HASHTAG HANDLER
    async function handleSuggestHashtags() {
        if (!content.trim() || !generatedPostId) {
            toast.error("Write or generate a post first.");
            return;
        }
        setIsLoadingHashtags(true);
        try {
            const { hashtags } = await suggestHashtags(content.trim(), generatedPostId);
            setHashtags(hashtags ?? []);
        } catch {
            toast.error("Hashtag generation pipeline execution failed.");
        } finally {
            setIsLoadingHashtags(false);
        }
    }

    // ✅ FINAL ACCEPT & LOCK DOWN DISPATCHER
    async function handleAcceptAndPublish() {
        if (!content.trim()) {
            toast.error("Nothing to submit. Generate or write a post layout first.");
            return;
        }
        if (!generatedPostId) {
            toast.error("Missing generation tracking parameters.");
            return;
        }

        const publishToast = toast.loading("Finalizing and embedding post architecture...");
        try {
            const fileIds = attachedFiles.map((f) => f._id);
            await acceptPost(generatedPostId, content.trim(), hashtags, fileIds);

            toast.success("Post successfully locked, saved, and optimized with background RAG vectors!", {
                id: publishToast
            });
        } catch (err: any) {
            toast.error(err?.message || "Verification lock routine failed.", { id: publishToast });
        }
    }

    // ---------- asset picker ----------
    async function loadApprovedFiles() {
        setIsLoadingFiles(true);
        try {
            const { files } = await getFiles();
            const onlyApproved = (files as FileRecord[]).filter(
                (f) => f.status === "approved"
            );
            setApprovedFiles(onlyApproved);
        } catch {
            toast.error("Failed to load Files & Docs library.");
        } finally {
            setIsLoadingFiles(false);
        }
    }

    async function loadRecommendations(silent = false) {
        if (!content.trim()) {
            if (!silent) toast.error("Write some post content first so AI knows what to look for.");
            return;
        }
        setIsLoadingRecommend(true);
        setRecommendNote(null);
        try {
            const { recommendations } = await recommendMedia(content.trim());
            if (!recommendations.length) {
                setRecommendNote("No close matches found in your approved files. Browse categories below.");
                setRecommendedFiles([]);
            } else {
                setRecommendedFiles(recommendations);
            }
        } catch {
            setRecommendNote("AI recommendations are unavailable right now. Browse categories below instead.");
            setRecommendedFiles([]);
        } finally {
            setIsLoadingRecommend(false);
        }
    }

    async function openPicker() {
        setIsPickerOpen(true);
        setRecommendNote(null);
        if (approvedFiles.length === 0) {
            await loadApprovedFiles();
        }
    }

    function toggleAttach(file: FileRecord) {
        setAttachedFiles((prev) =>
            prev.some((f) => f._id === file._id)
                ? prev.filter((f) => f._id !== file._id)
                : [...prev, file]
        );
    }

    function toggleAttachRecommendation(rec: MediaRecommendation) {
        const full = approvedFiles.find((f) => f._id === rec.fileId);
        if (full) {
            toggleAttach(full);
            return;
        }
        toggleAttach({ _id: rec.fileId, name: rec.name } as FileRecord);
    }

    const recommendedIds = useMemo(
        () => new Set(recommendedFiles.map((f) => f.fileId)),
        [recommendedFiles]
    );

    const visibleFiles = approvedFiles.filter(
        (f) => category === "all" || f.type === category
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Create Post</h1>
                <p className="text-muted-foreground text-sm">
                    Describe your topic, let AI draft it, then refine and attach media.
                </p>
            </div>

            {/* Prompt + generate */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">1. Topic / Prompt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Textarea
                        placeholder="e.g. Announce our new summer collection launch"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={3}
                    />
                    <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs font-medium text-muted-foreground">Tone:</span>
                        {["casual", "professional", "witty"].map((t) => (
                            <Button
                                key={t}
                                type="button"
                                onClick={() => setTone(t)}
                                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize border transition-colors ${tone === t
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground hover:bg-muted border-border"
                                    }`}
                            >
                                {t}
                            </Button>
                        ))}
                    </div>
                    {generateError && (
                        <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                            <AlertCircle className="h-3.5 w-3.5" /> {generateError}
                        </p>
                    )}
                    {/* FIXED: handleGenerate changed to handleGenerateOrRegenerate */}
                    <Button onClick={handleGenerateOrRegenerate} disabled={isGenerating} className="gap-2">
                        {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                        {isGenerating ? "Generating..." : suggestions.length ? "Regenerate" : "Generate post"}
                    </Button>
                </CardContent>
            </Card>

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">2. Pick a version</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        {isGenerating ?
                            Array.from({ length: 3 }).map((_, index) => (
                                <Skeleton className="w-full h-18" key={index} />
                            )) :
                            suggestions.map((s, i) => (
                                <Button
                                    variant={'outline'}
                                    key={i}
                                    onClick={() => useSuggestion(s)}
                                    className="h-auto min-h-18 p-3 text-left whitespace-normal wrap-break-word justify-start items-start"
                                >
                                    {s}
                                </Button>
                            ))
                        }
                    </CardContent>
                </Card>
            )}

            {/* Editable draft */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">3. Your post</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* FIXED: Mapped custom textarea state dispatcher */}
                    <Textarea
                        placeholder="Your post content will appear here — pick a suggestion above or write your own."
                        value={content}
                        onChange={(e) => handleTextareaChange(e.target.value)}
                        rows={5}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleSuggestHashtags} className="gap-1.5">
                            {isLoadingHashtags ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Hash className="h-3.5 w-3.5" />
                            )}
                            Suggest hashtags
                        </Button>
                        <Button variant="outline" size="sm" onClick={openPicker} className="gap-1.5">
                            <ImagePlus className="h-3.5 w-3.5" /> Attach Media
                        </Button>
                    </div>

                    {hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {hashtags.map((tag) => (
                                <Badge key={tag} size="sm" variant="secondary">
                                    #{tag}
                                </Badge>
                            ))}
                        </div>
                    )}

                    {attachedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {attachedFiles.map((file) => (
                                <span
                                    key={file._id}
                                    className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
                                >
                                    {file.name}
                                    <X
                                        className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                                        onClick={() => toggleAttach(file)}
                                    />
                                </span>
                            ))}
                        </div>
                    )}

                    {/* FIXED: handleSavePost converted to handleAcceptAndPublish */}
                    <Button onClick={handleAcceptAndPublish} className="w-full font-semibold">
                        Save post
                    </Button>
                </CardContent>
            </Card>

            {/* Asset picker dialog */}
            <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Attach Media</DialogTitle>
                    </DialogHeader>

                    {/* ---------- AI-recommended assets ---------- */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                Recommended for this post
                            </h4>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => loadRecommendations(false)}
                                disabled={isLoadingRecommend}
                                className="h-6 px-2 text-[11px]"
                            >
                                {isLoadingRecommend ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    "Refresh"
                                )}
                            </Button>
                        </div>

                        {!content.trim() ? (
                            <p className="text-xs text-muted-foreground">
                                Write your post content first to get AI-recommended files.
                            </p>
                        ) : isLoadingRecommend ? (
                            <p className="text-xs text-muted-foreground">Finding relevant files...</p>
                        ) : recommendedFiles.length > 0 ? (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {recommendedFiles.map((rec) => {
                                    const isSelected = attachedFiles.some((f) => f._id === rec.fileId);
                                    return (
                                        <button
                                            key={rec.fileId}
                                            onClick={() => toggleAttachRecommendation(rec)}
                                            title={`${Math.round(rec.score * 100)}% match match score`}
                                            className={`relative shrink-0 w-24 rounded-lg border p-2 text-left text-[11px] transition-colors ${isSelected
                                                ? "border-primary bg-primary/10"
                                                : "border-border hover:border-primary/50"
                                                }`}
                                        >
                                            <Sparkles className="absolute right-1.5 top-1.5 h-3 w-3 text-primary" />
                                            <span className="line-clamp-3 font-medium pr-3">{rec.name}</span>
                                            <span className="mt-1 block text-muted-foreground">
                                                {Math.round(rec.score * 100)}% match
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                {recommendNote ?? "No recommendations yet."}
                            </p>
                        )}
                    </div>

                    {/* ---------- Categorized full library ---------- */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border">
                        {CATEGORIES.map((c) => (
                            <button
                                key={c}
                                onClick={() => setCategory(c)}
                                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${category === c
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-accent"
                                    }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>

                    <ScrollArea className="h-72 rounded-md border p-2">
                        {isLoadingFiles ? (
                            <p className="p-4 text-sm text-muted-foreground">Loading approved files...</p>
                        ) : visibleFiles.length === 0 ? (
                            <p className="p-4 text-sm text-muted-foreground">No files found in this category.</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {visibleFiles.map((file) => {
                                    const isSelected = attachedFiles.some((f) => f._id === file._id);
                                    const isRecommended = recommendedIds.has(file._id);
                                    return (
                                        <button
                                            key={file._id}
                                            onClick={() => toggleAttach(file)}
                                            className={`relative aspect-square rounded-lg border p-2 text-left text-[11px] transition-colors ${isSelected
                                                ? "border-primary bg-primary/10"
                                                : "border-border hover:border-primary/50"
                                                }`}
                                        >
                                            {isRecommended && (
                                                <Sparkles className="absolute right-1.5 top-1.5 h-3 w-3 text-primary" />
                                            )}
                                            <span className="line-clamp-3 font-medium pr-3">{file.name}</span>
                                            <span className="mt-1 block uppercase text-muted-foreground">{file.type}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>

                    <DialogFooter>
                        <Button onClick={() => setIsPickerOpen(false)}>
                            Done ({attachedFiles.length} selected)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
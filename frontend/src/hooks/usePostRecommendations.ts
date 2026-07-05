import { useState, useEffect } from "react";

export function usePostRecommendations(content: string) {
    const [recommendations, setRecommendations] = useState(null);

    useEffect(() => {
        if (!content || content.trim().length < 5) return;

        const timer = setTimeout(async () => {
            const res = await fetch("/recommendations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });
            setRecommendations(await res.json());
        }, 500); // ✅ 500ms debounce

        return () => clearTimeout(timer); // pichla timer cancel karo agar user phir type kare
    }, [content]);

    return recommendations;
}
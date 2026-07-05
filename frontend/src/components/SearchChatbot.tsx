import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, ExternalLink, Loader2, Bot, User } from "lucide-react";

// Types derived directly from your backend response structure
interface Source {
  fileId: string;
  chunkIndex: number;
  fileUrl: string;
}

interface SearchResponse {
  results: string;
  sources: Source[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export default function SearchChatbot() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentQuery = query;
    setQuery("");
    setLoading(true);

    try {
      // Calling your endpoint on localhost:3000
      const response = await fetch(`http://localhost:3000/search?query=${encodeURIComponent(currentQuery)}`);
      if (!response.ok) throw new Error("Search request failed");
      
      const data: SearchResponse = await response.json();

      const botMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.results,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I encountered an error searching for that topic.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col shadow-lg">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" />
          <div>
            <CardTitle className="text-lg">Knowledge Base Search</CardTitle>
            <CardDescription>Ask questions regarding your uploaded documentation</CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* Messages Feed */}
      <CardContent className="flex-1 p-4 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground gap-2">
              <Search className="w-8 h-8 opacity-40 animate-pulse" />
              <p className="text-sm">Ask anything to query the documents...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 text-sm ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}

                  <div className="flex flex-col gap-2 max-w-[80%]">
                    <div
                      className={`rounded-lg px-4 py-2.5 shadow-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground border border-border"
                      }`}
                    >
                      {msg.content}
                    </div>

                    {/* Sources Sub-section for AI Responses */}
                    {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1 px-1">
                        <span className="text-[11px] text-muted-foreground block w-full">
                          Sources consulted:
                        </span>
                        {msg.sources.map((src, idx) => {
                          // Extract file name from the URL path for cleaner visualization
                          const fileName = src.fileUrl.split("/").pop() || `File-${src.fileId}`;
                          return (
                            <a
                              key={idx}
                              href={src.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="no-underline transition-transform hover:scale-[1.02]"
                            >
                              <Badge variant="secondary" className="flex items-center gap-1.5 py-1 px-2 text-[11px] font-normal cursor-pointer hover:bg-secondary/80">
                                <FileText className="w-3 h-3 text-muted-foreground" />
                                <span className="max-w-[150px] truncate">{fileName}</span>
                                <span className="text-[10px] text-muted-foreground">(Chunk {src.chunkIndex})</span>
                                <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-60" />
                              </Badge>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3 text-sm justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted text-muted-foreground border border-border rounded-lg px-4 py-2.5 flex items-center gap-2 shadow-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span>Searching vectors & documents...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* Input Form Bar */}
      <div className="p-4 border-t bg-muted/10">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., what are tuples in python?"
            disabled={loading}
            className="flex-1 focus-visible:ring-primary shadow-sm"
          />
          <Button type="submit" disabled={loading || !query.trim()} className="shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="sr-only">Search</span>
          </Button>
        </form>
      </div>
    </Card>
  );
}
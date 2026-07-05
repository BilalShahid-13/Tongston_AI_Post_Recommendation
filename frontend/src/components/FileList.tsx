import useSWR from "swr";
import { getFiles } from "../api";
import type { FileRecord } from "../types";
import ListCard from "./ListCard";
import { ScrollArea } from "./ui/scroll-area";

interface Props {
  refreshTrigger: number;
}

const fetcher = () => getFiles().then((data) => data.files as FileRecord[]);

export function FileList({ refreshTrigger }: Props) {

  const { data: files, error, isLoading } = useSWR(
    ["files", refreshTrigger],
    fetcher,
    {
      refreshInterval: 5000, // poll every 5s as a fallback alongside SSE
    }
  );

  if (isLoading) return <p>Loading files...</p>;
  if (error) return <p style={{ color: "red" }}>Failed to load files</p>;
  if (!files || files.length === 0) return <p>No files uploaded yet.</p>;
  return (
    <div>
      <h3 className="text-lg font-bold mb-4 text-slate-800
       dark:text-slate-100">Files</h3>
      <ScrollArea className="rounded-lg h-72 w-full border p-2">
        {files.map((file) => (
          <ListCard key={file._id} {...file} />
        ))}
      </ScrollArea>
    </div>
  );
}
import { useEffect, useState } from "react"
import { type FileMetadata } from "@/hooks/use-file-upload"
import { FileBox, FileCode, FileSpreadsheet, FileText, Loader2 } from "lucide-react"

import * as pdfjsLib from "pdfjs-dist"
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { Skeleton } from "./ui/skeleton";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

interface ThumbnailProps {
  file: File | FileMetadata
  preview?: string
}

export function FileThumbnail({ file, preview }: ThumbnailProps) {
  const type = file?.type?.toLowerCase() || ""
  const name = file?.name?.toLowerCase() || ""

  const [pdfThumbnail, setPdfThumbnail] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const isPDF = type.includes("pdf") || name.endsWith(".pdf")
    let isMounted = true

    if (isPDF && file instanceof File) {
      const generatePdfPreview = async () => {
        try {
          if (isMounted) setIsGenerating(true)

          const arrayBuffer = await file.arrayBuffer()
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
          const pdf = await loadingTask.promise
          const page = await pdf.getPage(1)
          const viewport = page.getViewport({ scale: 0.3 })

          const canvas = document.createElement("canvas")
          const context = canvas.getContext("2d")
          canvas.height = viewport.height
          canvas.width = viewport.width

          if (context) {
            await page.render({
              canvasContext: context,
              viewport: viewport,
              canvas: canvas,
            }).promise

            if (isMounted) {
              setPdfThumbnail(canvas.toDataURL("image/jpeg", 0.8))
            }
          }
        } catch (err) {
          console.error("PDF thumbnail extraction failed:", err)
        } finally {
          if (isMounted) setIsGenerating(false)
        }
      }
      generatePdfPreview()
    }

    return () => {
      isMounted = false
      setPdfThumbnail(null)
      setIsGenerating(false)
    }
  }, [file, type, name])

  if (preview && type.startsWith("image/")) {
    return <img src={preview} alt={file.name} className="rounded-lg h-11 w-11 border object-cover shadow-sm" />
  }

  if (type.includes("pdf") || name.endsWith(".pdf")) {
    if (pdfThumbnail) {
      return (
        <div className="relative h-full w-full object-cover rounded-lg border overflow-hidden shadow-sm group">
          <img src={pdfThumbnail} alt="PDF Preview" className="h-full w-full object-cover" />
          <div className="absolute bottom-0 inset-x-0 bg-rose-600 text-white text-[7px] font-extrabold text-center py-0.5 tracking-wide uppercase">
            PDF
          </div>
        </div>
      )
    }

    if (isGenerating) {
      return (
        <div className=" rounded-lg flex h-11 w-11 items-center justify-center shadow-sm">
          <Skeleton className="h-full w-full object-cover rounded-md animate-pulse" />
        </div>
      )
    }

    return (
      <div className="bg-rose-50 border border-rose-100 dark:bg-rose-950/40 dark:border-rose-900/40 text-rose-600 rounded-lg flex flex-col h-11 w-11 items-center justify-center shadow-sm">
        <FileText className="size-5" />
        <span className="text-[8px] font-extrabold uppercase mt-0.5 tracking-tighter">PDF</span>
      </div>
    )
  }

  if (type.includes("word") || name.endsWith(".docx") || name.endsWith(".doc")) {
    return (
      <div className="bg-blue-50 border border-blue-100 dark:bg-blue-950/40 dark:border-blue-900/40 text-blue-600 rounded-lg flex flex-col h-11 w-11 items-center justify-center shadow-sm">
        <FileText className="size-5" />
        <span className="text-[8px] font-extrabold uppercase mt-0.5 tracking-tighter">DOC</span>
      </div>
    )
  }

  if (type.includes("excel") || type.includes("sheet") || name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900/40 text-emerald-600 rounded-lg flex flex-col h-11 w-11 items-center justify-center shadow-sm">
        <FileSpreadsheet className="size-5" />
        <span className="text-[8px] font-extrabold uppercase mt-0.5 tracking-tighter">XLSM</span>
      </div>
    )
  }

  if (type.includes("text/plain") || name.endsWith(".txt")) {
    return (
      <div className="bg-slate-50 border border-slate-100 dark:bg-slate-900 dark:border-slate-800 text-slate-600 rounded-lg flex flex-col h-11 w-11 items-center justify-center shadow-sm">
        <FileCode className="size-5" />
        <span className="text-[8px] font-extrabold uppercase mt-0.5 tracking-tighter">TXT</span>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-100 dark:bg-amber-950/40 dark:border-amber-900/40 text-amber-600 rounded-lg flex flex-col h-11 w-11 items-center justify-center shadow-sm">
      <FileBox className="size-5" />
      <span className="text-[8px] font-extrabold uppercase mt-0.5 tracking-tighter">FILE</span>
    </div>
  )
}
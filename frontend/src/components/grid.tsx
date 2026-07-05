import React from 'react'

export default function grid() {
    return (
           {uploadStore.uploadFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadStore.uploadFiles.map((fileItem) => (
            <div key={fileItem.id}
              className="border-slate-100 bg-white rounded-xl border p-3 dark:border-slate-800 dark:bg-slate-950 grid grid-cols-4">
              <div className="flex items-start gap-3">

                {/* 🎨 RENDERED CUSTOM DYNAMIC THUMBNAIL COMPONENT */}
                <div className="shrink-0 w-32 h-32">
                  <FileThumbnail file={fileItem.file} preview={fileItem.preview} />
                </div>

                {/* <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="truncate pr-4">
                      <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{fileItem.file.name}</p>
                      <p className="text-muted-foreground text-[11px]">{formatBytes(fileItem.file.size)}</p>
                    </div>
                    <Button
                      onClick={(e) => { e.stopPropagation(); removeUploadFile(fileItem.id); }}
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>

                  {fileItem.status === "idle" && <div className="text-[11px] mt-1 font-medium text-amber-600">Ready to upload</div>}
                  {fileItem.status === "completed" && <div className="text-[11px] mt-1 font-medium text-emerald-600">File saved successfully</div>}

                  {fileItem.status === "uploading" && (
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={fileItem.progress} className="h-1 flex-1 bg-slate-100" />
                      <span className="text-[10px] font-bold text-slate-500">Processing...</span>
                    </div>
                  )}

                  {fileItem.status === "error" && fileItem.error && (
                    <div className="mt-2 bg-rose-50 text-rose-800 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50 px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertCircle className="size-4 shrink-0 text-rose-500" />
                        <span className="text-[11px] font-medium leading-none truncate">{fileItem.error}</span>
                      </div>
                      <Button onClick={(e) => { e.stopPropagation(); uploadStore.processNativeServerUpload(fileItem, onUploadSuccess); }} variant="ghost" size="icon" className="h-5 w-5 hover:bg-transparent shrink-0">
                        <RotateCcw className="size-3 text-rose-600" />
                      </Button>
                    </div>
                  )}
                </div> */}
              </div>
            </div>
          ))}
        </div>
      )}
    )
}

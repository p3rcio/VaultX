// FileUpload.tsx — drag-and-drop upload area with per-file progress bars and automatic tag generation
"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { uploadFile, UploadProgress } from "@/lib/upload";
import { generateTags } from "@/lib/tags";
import { api } from "@/lib/api";

interface Props {
  onUploadComplete?: () => void;
}

export default function FileUpload({ onUploadComplete }: Props) {
  const { umk } = useAuth();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || !umk) return;

    // upload files one at a time — parallel uploads could saturate the connection
    for (const file of Array.from(files)) {
      if (file.size > 1024 * 1024 * 1024) {
        alert(`"${file.name}" exceeds 1 GB limit.`);
        continue;
      }

      // AbortController lets the upload be cancelled or paused mid-way
      abortRef.current = new AbortController();

      try {
        const fileId = await uploadFile(
          file,
          umk,
          (progress) => {
            // match by filename and update that entry in the list, or append if new
            setUploads((prev) => {
              const idx = prev.findIndex((u) => u.fileName === file.name);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = progress;
                return next;
              }
              return [...prev, progress];
            });
          },
          abortRef.current.signal
        );

        // auto-tag from filename/type/size once the upload completes
        const tags = generateTags(file.name, file.type, file.size);
        if (tags.length > 0) {
          await api.setTags(fileId, tags);
        }

        onUploadComplete?.();
      } catch (err: any) {
        console.error("Upload failed:", err);
      }
    }
  }

  const statusColor: Record<string, string> = {
    queued: "text-gray-500",
    uploading: "text-blue-600",
    paused: "text-yellow-600",
    completed: "text-green-600",
    failed: "text-red-600",
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${dragOver ? "border-brand-500 bg-brand-50" : "border-gray-300 hover:border-gray-400"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <p className="text-gray-600 font-medium">
          Drop files here or click to browse
        </p>
        <p className="text-sm text-gray-400 mt-1">Max 1 GB per file</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          aria-label="File input"
        />
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u, i) => (
            <div key={i} className="bg-white rounded-lg border p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium truncate max-w-[60%]">
                  {u.fileName}
                </span>
                <span className={`text-xs font-semibold uppercase ${statusColor[u.status]}`}>
                  {u.status}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-brand-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${u.totalChunks ? (u.completedChunks / u.totalChunks) * 100 : 0}%`,
                  }}
                />
              </div>

              <p className="text-xs text-gray-400 mt-1">
                {u.completedChunks}/{u.totalChunks} chunks
                {u.error && <span className="text-red-500 ml-2">{u.error}</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

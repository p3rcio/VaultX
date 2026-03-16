// FileUpload.tsx — drag-and-drop upload zone with name editing before upload starts
"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { uploadFile, UploadProgress } from "@/lib/upload";
import { generateTags } from "@/lib/tags";
import { api } from "@/lib/api";

interface Props {
  onUploadComplete?: () => void;
}

// files waiting to be uploaded — user can edit the name before starting
interface StagedFile {
  id: string; // just a local key for React
  file: File;
  name: string;
}

const statusLabel: Record<string, string> = {
  queued: "Queued",
  uploading: "Uploading",
  paused: "Paused",
  completed: "Complete",
  failed: "Failed",
};

const statusColor: Record<string, string> = {
  queued: "bg-on-surface-muted/15 text-on-surface-muted",
  uploading: "bg-accent/15 text-accent",
  paused: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  failed: "bg-error/15 text-error",
};

export default function FileUpload({ onUploadComplete }: Props) {
  const { umk } = useAuth();
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function stageFiles(files: FileList | null) {
    if (!files) return;
    const valid: StagedFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 1024 * 1024 * 1024) {
        alert(`"${file.name}" exceeds the 1 GB limit.`);
        continue;
      }
      valid.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, file, name: file.name });
    }
    setStaged((prev) => [...prev, ...valid]);
  }

  function updateStagedName(id: string, name: string) {
    setStaged((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));
  }

  function removeStagedFile(id: string) {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  }

  async function startUploads() {
    if (!umk || staged.length === 0) return;
    const toUpload = [...staged];
    setStaged([]);

    for (const { file, name } of toUpload) {
      abortRef.current = new AbortController();
      try {
        const fileId = await uploadFile(
          file,
          umk,
          (progress) => {
            setUploads((prev) => {
              const idx = prev.findIndex((u) => u.fileId === progress.fileId || (u.fileId === "" && u.fileName === progress.fileName));
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = progress;
                return next;
              }
              return [...prev, progress];
            });
          },
          abortRef.current.signal,
          name.trim() || file.name
        );
        const tags = generateTags(file.name, file.type, file.size);
        if (tags.length > 0) await api.setTags(fileId, tags);
        onUploadComplete?.();
      } catch (err: any) {
        console.error("Upload failed:", err);
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all
          ${dragOver
            ? "border-accent dropzone-active bg-accent/5"
            : "border-on-surface-muted/20 hover:border-accent/50 hover:bg-surface-high/50"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); stageFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload files — click or drag and drop"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${dragOver ? "bg-accent" : "bg-surface-high"}`} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dragOver ? "white" : "#2563EB"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface">
              Drop files here or <span className="text-accent">browse</span>
            </p>
            <p className="text-xs text-on-surface-muted mt-1">Up to 1 GB per file</p>
          </div>
        </div>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => stageFiles(e.target.files)} aria-label="File input" />
      </div>

      {/* Staged files — waiting to upload, names are editable */}
      {staged.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider px-1">Ready to Upload</h3>
          {staged.map((s) => (
            <div key={s.id} className="bg-surface-high rounded-lg border border-white/5 px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => updateStagedName(s.id, e.target.value)}
                  className="w-full bg-surface border border-white/10 rounded px-2.5 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  aria-label="File name"
                  placeholder="File name"
                />
                <p className="text-xs text-on-surface-muted mt-1 truncate">{s.file.name} · {(s.file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button
                onClick={() => removeStagedFile(s.id)}
                className="text-on-surface-muted hover:text-error transition-colors shrink-0 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
                aria-label="Remove file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={startUploads}
            className="w-full bg-accent hover:bg-accent-hover text-white rounded-md px-5 py-2.5 text-sm font-medium transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-surface"
          >
            Upload {staged.length === 1 ? "1 file" : `${staged.length} files`}
          </button>
        </div>
      )}

      {/* Upload queue — active/completed uploads */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider px-1">Upload Queue</h3>
          {uploads.map((u, i) => (
            <div key={i} className="bg-surface-high rounded-lg border border-white/5 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-on-surface truncate max-w-[70%]">{u.fileName}</p>
                <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${statusColor[u.status]}`}>
                  {statusLabel[u.status]}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-surface rounded-full h-1" aria-hidden="true">
                <div
                  className="bg-accent h-1 rounded-full progress-bar"
                  style={{ width: `${u.totalChunks ? (u.completedChunks / u.totalChunks) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-on-surface-muted mt-1.5">
                {u.completedChunks} / {u.totalChunks} chunks
                {u.error && <span className="text-error ml-2">{u.error}</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

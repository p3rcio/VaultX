"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface FileEntry {
  id: string;
  name: string;
  size: number;
  mime: string;
  created_at: string;
  tags: { tag_id: string; tag_name: string; confidence: number }[];
}

interface Props {
  refreshKey?: number;
}

function fileTypeBadge(mime: string): { label: string; color: string } {
  if (mime.includes("pdf")) return { label: "PDF", color: "bg-red-500/15 text-red-400" };
  if (mime.startsWith("image/")) return { label: "IMG", color: "bg-accent/15 text-accent" };
  if (mime.startsWith("video/")) return { label: "VID", color: "bg-purple-500/15 text-purple-400" };
  if (mime.startsWith("audio/")) return { label: "AUD", color: "bg-pink-500/15 text-pink-400" };
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("compressed")) return { label: "ZIP", color: "bg-yellow-500/15 text-yellow-400" };
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return { label: "XLS", color: "bg-green-500/15 text-green-400" };
  if (mime.includes("presentation")) return { label: "PPT", color: "bg-orange-500/15 text-orange-400" };
  if (mime.startsWith("text/") || mime.includes("javascript") || mime.includes("typescript") || mime.includes("json")) return { label: "CODE", color: "bg-accent/15 text-accent-hover" };
  if (mime.includes("word") || mime.includes("document")) return { label: "DOC", color: "bg-blue-400/15 text-blue-300" };
  return { label: "FILE", color: "bg-surface-high text-on-surface-muted" };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function FileIcon({ mime }: { mime: string }) {
  const { label, color } = fileTypeBadge(mime);
  return (
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xs font-bold tracking-wide ${color}`} aria-hidden="true">
      {label}
    </div>
  );
}

export default function FileList({ refreshKey }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listFiles(search, tagFilter);
      setFiles(res.files);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setLoading(false);
    }
  }, [search, tagFilter]);

  useEffect(() => { fetchFiles(); }, [fetchFiles, refreshKey]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const allTags = Array.from(new Set(files.flatMap((f) => f.tags.map((t) => t.tag_name)))).sort();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-surface rounded-lg h-40 animate-pulse border border-white/5" aria-hidden="true" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Filter files..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-surface border border-white/10 rounded-md pl-8 pr-4 py-2 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            aria-label="Search files"
          />
        </div>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="bg-surface border border-white/10 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          aria-label="Filter by tag"
        >
          <option value="">All tags</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center mb-4" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-on-surface mb-1">No files yet</h3>
          <p className="text-sm text-on-surface-muted">Upload your first file using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {files.map((f) => (
            <Link
              key={f.id}
              href={`/files/${f.id}`}
              className="group bg-surface border border-white/5 rounded-lg p-4 flex flex-col gap-3 shadow-elevation-1 hover:shadow-elevation-2 hover:border-accent/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              aria-label={`Open ${f.name}`}
            >
              <div className="flex items-start justify-between">
                <FileIcon mime={f.mime} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate group-hover:text-accent transition-colors">{f.name}</p>
                <p className="text-xs text-on-surface-muted mt-0.5">
                  {formatSize(f.size)} · {new Date(f.created_at).toLocaleDateString()}
                </p>
              </div>
              {f.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {f.tags.slice(0, 3).map((t) => (
                    <span key={t.tag_id} className="bg-accent/10 text-accent text-xs font-medium rounded-full px-2 py-0.5">
                      {t.tag_name}
                    </span>
                  ))}
                  {f.tags.length > 3 && (
                    <span className="text-xs text-on-surface-muted py-0.5">+{f.tags.length - 3}</span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

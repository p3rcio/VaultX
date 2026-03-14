// file detail page — two-column layout: metadata on left, actions + tags on right
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { downloadOwnFile } from "@/lib/download";
import Sidebar from "@/components/Sidebar";
import ShareDialog from "@/components/ShareDialog";
import TagEditor from "@/components/TagEditor";

interface FileData {
  id: string;
  name: string;
  size: number;
  mime: string;
  total_chunks: number;
  created_at: string;
  wrapped_key: string;
  tags: { tag_id: string; tag_name: string; confidence: number }[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}
function IconShare() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

export default function FileDetailPage() {
  const { user, umk, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const fileId = params.id as string;

  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchFile = useCallback(async () => {
    try {
      const res = await api.getFile(fileId);
      setFile(res.file);
    } catch {
      // file not found or doesn't belong to this user — back to dashboard
      router.replace("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [fileId, router]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
    else if (user) fetchFile();
  }, [user, authLoading, router, fetchFile]);

  async function handleDownload() {
    if (!umk || !file) return;
    setDownloading(true);
    try {
      await downloadOwnFile(file.id, umk);
    } catch (err: any) {
      alert("Download failed: " + err.message);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this file?")) return;
    try {
      // soft delete — sets deleted_at so the file is hidden but not permanently gone
      await api.deleteFile(fileId);
      router.push("/dashboard");
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden="true" />
          <p className="text-on-surface-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!file) return null;

  // get a coloured background for the file type display
  const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";

  return (
    <div className="flex bg-primary">
      <Sidebar />

      <div className="main-with-sidebar">
        {/* Topbar breadcrumb */}
        <header className="sticky top-0 z-20 bg-primary/80 backdrop-blur-sm border-b border-white/5 py-4">
          <div className="max-w-7xl mx-auto px-8 flex items-center gap-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-on-surface-muted hover:text-on-surface text-sm transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Dashboard
          </button>
          <svg width="14" height="14" className="text-on-surface-muted/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span className="text-sm text-on-surface truncate max-w-xs">{file.name}</span>
          </div>
        </header>

        {/* Two-column content */}
        <main className="py-8">
          <div className="max-w-5xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: file icon + metadata */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface rounded-lg border border-white/5 p-8 flex flex-col items-center justify-center min-h-[200px]">
              <div className="w-20 h-20 rounded-xl bg-accent/10 flex items-center justify-center text-2xl font-bold text-accent mb-4" aria-hidden="true">
                {ext}
              </div>
              <h1 className="text-lg font-semibold text-on-surface text-center break-all">{file.name}</h1>
              <p className="text-sm text-on-surface-muted mt-1">{file.mime}</p>
            </div>

            {/* Metadata table */}
            <div className="bg-surface rounded-lg border border-white/5 overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5">
                <h2 className="text-sm font-semibold text-on-surface">File Details</h2>
              </div>
              <dl className="divide-y divide-white/5">
                {([
                  ["Size", formatSize(file.size)],
                  ["Type", file.mime],
                  ["Chunks", String(file.total_chunks)],
                  ["Uploaded", new Date(file.created_at).toLocaleString()],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="px-5 py-3 flex items-center justify-between">
                    <dt className="text-sm text-on-surface-muted">{label}</dt>
                    <dd className="text-sm text-on-surface font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* Right: actions + tags */}
          <div className="space-y-4">
            {/* Actions card */}
            <div className="bg-surface rounded-lg border border-white/5 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-on-surface">Actions</h2>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent-hover text-white rounded-md px-5 py-2.5 text-sm font-medium transition-colors active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-surface"
              >
                <IconDownload />
                {downloading ? "Downloading..." : "Download"}
              </button>
              <button
                onClick={() => setShowShare(true)}
                className="flex items-center justify-center gap-2 w-full border border-accent text-accent hover:bg-accent/10 rounded-md px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-surface"
              >
                <IconShare />
                Share
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center justify-center gap-2 w-full text-on-surface-muted hover:text-error hover:bg-error/10 rounded-md px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
              >
                <IconTrash />
                Delete
              </button>
            </div>

            {/* Tags card */}
            <div className="bg-surface rounded-lg border border-white/5 p-5">
              <h2 className="text-sm font-semibold text-on-surface mb-3">Tags</h2>
              <TagEditor fileId={file.id} tags={file.tags} onUpdate={fetchFile} />
            </div>
          </div>
          </div>
        </main>
      </div>

      {showShare && (
        <ShareDialog fileId={file.id} wrappedKey={file.wrapped_key} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}

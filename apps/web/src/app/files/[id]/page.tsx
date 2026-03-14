// file detail page — metadata, tags, download, share, and delete for a single file
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { downloadOwnFile } from "@/lib/download";
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

  // wait for auth to resolve before deciding to redirect or load the file
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

  // converts raw bytes into a human-readable string
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!file) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-brand-600 hover:underline text-sm">
          &larr; Dashboard
        </Link>
        <h1 className="text-lg font-bold text-brand-600">VaultX</h1>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{file.name}</h2>

          <dl className="grid grid-cols-2 gap-y-2 text-sm mb-6">
            <dt className="text-gray-500">Size</dt>
            <dd>{formatSize(file.size)}</dd>
            <dt className="text-gray-500">Type</dt>
            <dd>{file.mime}</dd>
            <dt className="text-gray-500">Chunks</dt>
            <dd>{file.total_chunks}</dd>
            <dt className="text-gray-500">Uploaded</dt>
            <dd>{new Date(file.created_at).toLocaleString()}</dd>
          </dl>

          {/* Tags */}
          <TagEditor
            fileId={file.id}
            tags={file.tags}
            onUpdate={fetchFile}
          />

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {downloading ? "Downloading..." : "Download"}
            </button>
            <button
              onClick={() => setShowShare(true)}
              className="bg-white border border-brand-600 text-brand-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-50 transition-colors"
            >
              Share
            </button>
            <button
              onClick={handleDelete}
              className="ml-auto text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      </main>

      {showShare && (
        <ShareDialog
          fileId={file.id}
          wrappedKey={file.wrapped_key}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

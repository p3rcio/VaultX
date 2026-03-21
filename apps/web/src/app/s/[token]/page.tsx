"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { downloadSharedFile, DownloadProgress } from "@/lib/download";

export default function ShareLinkPage() {
  const params = useParams();
  const token = params.token as string;
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState("");

  async function handleDownload() {
    setError("");
    try {
      await downloadSharedFile(token, (p) => setProgress({ ...p }));
    } catch (err: any) {
      setError(err.message || "Download failed");
      setProgress(null);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #111827 0%, #0A0F1E 70%)" }}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <div className="w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm bg-surface border border-white/8 rounded-xl shadow-elevation-3 p-8 text-center">
        <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mx-auto mb-5 shadow-accent-glow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>

        <h1 className="text-lg font-semibold text-on-surface mb-1">
          <span className="text-accent">VaultX</span> Shared File
        </h1>
        <p className="text-sm text-on-surface-muted mb-6">
          End-to-end encrypted. Click below to download and decrypt it in your browser — no account needed.
        </p>

        {error && (
          <div className="bg-error/10 border border-error/20 rounded-md px-4 py-3 mb-4 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-error text-sm" role="alert">{error}</p>
          </div>
        )}

        {!progress || progress.status === "failed" ? (
          <button
            onClick={handleDownload}
            className="w-full bg-accent hover:bg-accent-hover text-white rounded-md px-5 py-2.5 text-sm font-medium transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-surface shadow-accent-glow"
          >
            Download &amp; Decrypt
          </button>
        ) : (
          <div className="space-y-3 text-left">
            <div className="w-full bg-surface-high rounded-full h-1" aria-hidden="true">
              <div
                className="bg-accent h-1 rounded-full progress-bar"
                style={{ width: `${progress.totalChunks ? (progress.completedChunks / progress.totalChunks) * 100 : 0}%` }}
              />
            </div>
            <p className="text-sm text-on-surface-muted text-center capitalize">
              {progress.status}… {progress.completedChunks}/{progress.totalChunks} chunks
            </p>
          </div>
        )}

        {progress?.status === "complete" && (
          <div className="bg-success/10 border border-success/20 rounded-md px-4 py-3 mt-4 flex items-center gap-2 justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <p className="text-success text-sm font-medium">Download complete! Check your downloads folder.</p>
          </div>
        )}
      </div>
    </div>
  );
}

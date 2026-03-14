// public share link page — no login needed, decrypts and downloads a shared file in the browser
// the token in the URL is the raw secret that was used to wrap the file key
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
      // download.ts handles hashing the token, fetching the share record, and decrypting
      await downloadSharedFile(token, (p) => setProgress({ ...p }));
    } catch (err: any) {
      setError(err.message || "Download failed");
      setProgress(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6 text-center">
        <h1 className="text-xl font-bold mb-2">
          <span className="text-brand-600">VaultX</span> Shared File
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          This file is end-to-end encrypted. Click below to download and decrypt
          it in your browser.
        </p>

        {error && (
          <p className="text-red-600 text-sm mb-4" role="alert">
            {error}
          </p>
        )}

        {!progress || progress.status === "failed" ? (
          <button
            onClick={handleDownload}
            className="w-full bg-brand-600 text-white rounded-lg py-2 font-medium hover:bg-brand-700 transition-colors"
          >
            Download &amp; Decrypt
          </button>
        ) : (
          <div className="space-y-3">
            {/* progress bar showing how many chunks have been decrypted */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-brand-500 h-2 rounded-full transition-all"
                style={{
                  width: `${
                    progress.totalChunks
                      ? (progress.completedChunks / progress.totalChunks) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-sm text-gray-500 capitalize">
              {progress.status}...{" "}
              {progress.completedChunks}/{progress.totalChunks} chunks
            </p>
          </div>
        )}

        {progress?.status === "complete" && (
          <p className="text-green-600 text-sm mt-4 font-medium">
            Download complete! Check your browser downloads.
          </p>
        )}
      </div>
    </div>
  );
}

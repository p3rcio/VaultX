// main dashboard — sidebar + topbar + file card grid
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import FileList from "@/components/FileList";
import FileUpload from "@/components/FileUpload";

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden="true" />
          <p className="text-on-surface-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-primary">
      <Sidebar />

      <div className="main-with-sidebar flex flex-col">
        {/* Sticky topbar */}
        <header className="sticky top-0 z-20 bg-primary/80 backdrop-blur-sm border-b border-white/5 py-4">
          <div className="max-w-7xl mx-auto px-8 flex items-center gap-4">
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="search"
                  placeholder="Search files..."
                  aria-label="Search files"
                  className="w-full bg-surface border border-white/10 rounded-md pl-9 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                  onChange={(_e) => {
                    // search is handled inside FileList via refreshKey trick — pass via URL or state if needed
                  }}
                />
              </div>
            </div>
            <button
              onClick={() => setShowUpload((v) => !v)}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-md px-5 py-2.5 text-sm font-medium transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-primary"
            >
              <IconUpload />
              Upload
            </button>
          </div>
        </header>

        {/* Upload panel — slides in below topbar */}
        {showUpload && (
          <div className="pt-6">
            <div className="max-w-7xl mx-auto px-8">
              <div className="bg-surface rounded-lg border border-white/8 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-on-surface">Upload Files</h2>
                  <button
                    onClick={() => setShowUpload(false)}
                    className="text-on-surface-muted hover:text-on-surface transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label="Close upload panel"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <FileUpload onUploadComplete={() => { setRefreshKey((k) => k + 1); setShowUpload(false); }} />
              </div>
            </div>
          </div>
        )}

        {/* File grid */}
        <main className="flex-1 py-6">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-semibold text-on-surface">My Files</h1>
            </div>
            <FileList refreshKey={refreshKey} />
          </div>
        </main>
      </div>
    </div>
  );
}

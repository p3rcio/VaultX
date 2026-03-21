// shared-with-me page — shows share links from other users that the current user has accessed
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

interface SharedWithMeEntry {
  id: string;
  share_id: string;
  file_name_snapshot: string;
  sharer_email_snapshot: string;
  accessed_at: string;
  file_id: string;
  expires_at: string;
  disabled_at: string | null;
}

function isActive(entry: SharedWithMeEntry): boolean {
  return !entry.disabled_at && new Date(entry.expires_at) > new Date();
}

function StatusBadge({ entry }: { entry: SharedWithMeEntry }) {
  if (entry.disabled_at) {
    return <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-error/15 text-error">Revoked</span>;
  }
  if (new Date(entry.expires_at) <= new Date()) {
    return <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-error/15 text-error">Expired</span>;
  }
  const daysLeft = Math.ceil((new Date(entry.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 3) {
    return <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-warning/15 text-warning">Expires in {daysLeft}d</span>;
  }
  return <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-success/15 text-success">Active</span>;
}

export default function SharedWithMePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<SharedWithMeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "expired">("active");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
    else if (user) fetchEntries();
  }, [user, authLoading, router]);

  async function fetchEntries() {
    try {
      const res = await api.getSharedWithMe();
      setEntries(res.shares);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden="true" />
          <p className="text-on-surface-muted text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  const activeEntries  = entries.filter((e) => isActive(e));
  const expiredEntries = entries.filter((e) => !isActive(e));
  const displayed = activeTab === "active" ? activeEntries : expiredEntries;

  return (
    <div className="flex min-h-screen bg-primary">
      <Sidebar />
      <div className="main-with-sidebar">
        <header className="sticky top-0 z-20 bg-primary/80 backdrop-blur-sm border-b border-white/5 py-4">
          <div className="max-w-4xl mx-auto px-8">
            <h1 className="text-xl font-semibold text-on-surface">Shared With Me</h1>
          </div>
        </header>

        <main className="py-8">
          <div className="max-w-4xl mx-auto px-8">

            {/* Tabs */}
            <div className="flex gap-6 border-b border-white/10 mb-6" role="tablist">
              <button
                id="tab-active-swm"
                role="tab"
                aria-selected={activeTab === "active"}
                aria-controls="panel-swm"
                onClick={() => setActiveTab("active")}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t
                  ${activeTab === "active"
                    ? "border-accent text-accent"
                    : "border-transparent text-on-surface-muted hover:text-on-surface"}`}
              >
                Active
                {activeEntries.length > 0 && (
                  <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${activeTab === "active" ? "bg-accent/15 text-accent" : "bg-surface-high text-on-surface-muted"}`}>
                    {activeEntries.length}
                  </span>
                )}
              </button>
              <button
                id="tab-expired-swm"
                role="tab"
                aria-selected={activeTab === "expired"}
                aria-controls="panel-swm"
                onClick={() => setActiveTab("expired")}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t
                  ${activeTab === "expired"
                    ? "border-accent text-accent"
                    : "border-transparent text-on-surface-muted hover:text-on-surface"}`}
              >
                Expired / Revoked
                {expiredEntries.length > 0 && (
                  <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${activeTab === "expired" ? "bg-accent/15 text-accent" : "bg-surface-high text-on-surface-muted"}`}>
                    {expiredEntries.length}
                  </span>
                )}
              </button>
            </div>

            <div
              id="panel-swm"
              role="tabpanel"
              aria-labelledby={activeTab === "active" ? "tab-active-swm" : "tab-expired-swm"}
            >
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5">
                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                  </svg>
                </div>
                {activeTab === "active" ? (
                  <>
                    <p className="text-sm font-medium text-on-surface mb-1">No active shares</p>
                    <p className="text-xs text-on-surface-muted max-w-xs">
                      When someone shares a VaultX file with you and you open the link while logged in, it will appear here.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-muted">No expired or revoked links.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {displayed.map((entry) => {
                  const active = isActive(entry);
                  return (
                    <div
                      key={entry.id}
                      className="bg-surface rounded-lg border border-white/5 px-5 py-4 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {/* File icon */}
                        <div className="w-9 h-9 rounded-md bg-accent/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                            <polyline points="13 2 13 9 20 9"/>
                          </svg>
                        </div>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-on-surface truncate">
                            {entry.file_name_snapshot}
                          </p>
                          <p className="text-xs text-on-surface-muted mt-0.5">
                            Shared by {entry.sharer_email_snapshot}
                            {" · "}
                            {active
                              ? `Expires ${new Date(entry.expires_at).toLocaleDateString()}`
                              : entry.disabled_at
                                ? `Revoked ${new Date(entry.disabled_at).toLocaleDateString()}`
                                : `Expired ${new Date(entry.expires_at).toLocaleDateString()}`
                            }
                          </p>
                        </div>

                        {/* Status badge */}
                        <div className="flex-shrink-0">
                          <StatusBadge entry={entry} />
                        </div>
                      </div>

                      {/* Active: hint about the original link (can't reconstruct URL — ZK constraint) */}
                      {active && (
                        <div className="mt-3 ml-13 pl-[52px]">
                          <p className="text-xs text-on-surface-muted bg-surface-high rounded-md px-3 py-2">
                            To download this file, use the original share link you were sent. VaultX cannot reconstruct the link because the decryption key lives in the URL only.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

interface Share {
  id: string;
  file_id: string;
  file_name: string;
  role: string;
  expires_at: string;
  created_at: string;
  disabled_at: string | null;
}

function isExpired(s: Share): boolean { return new Date(s.expires_at) < new Date(); }

function ExpiryBadge({ share }: { share: Share }) {
  const expired = isExpired(share);
  const disabled = !!share.disabled_at;

  const daysLeft = Math.ceil((new Date(share.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (disabled) return <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-error/15 text-error">Disabled</span>;
  if (expired) return <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-error/15 text-error">Expired</span>;
  if (daysLeft <= 3) return <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-warning/15 text-warning">Expires in {daysLeft}d</span>;
  return <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-success/15 text-success">Active</span>;
}

export default function SharedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "expired">("active");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
    else if (user) fetchShares();
  }, [user, authLoading, router]);

  async function fetchShares() {
    try {
      const res = await api.listMyShares();
      setShares(res.shares);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(shareId: string) {
    if (!confirm("Disable this share link?")) return;
    try {
      await api.disableShare(shareId);
      fetchShares();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden="true" />
          <p className="text-on-surface-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const activeShares = shares.filter((s) => !isExpired(s) && !s.disabled_at);
  const inactiveShares = shares.filter((s) => isExpired(s) || !!s.disabled_at);
  const displayShares = activeTab === "active" ? activeShares : inactiveShares;

  return (
    <div className="flex bg-primary">
      <Sidebar />
      <div className="main-with-sidebar">
        <header className="sticky top-0 z-20 bg-primary/80 backdrop-blur-sm border-b border-white/5 py-4">
          <div className="max-w-4xl mx-auto px-8">
            <h1 className="text-xl font-semibold text-on-surface">My Shares</h1>
          </div>
        </header>

        <main className="py-8">
          <div className="max-w-4xl mx-auto px-8">
          <div className="flex gap-6 border-b border-white/10 mb-6" role="tablist">
            <button
              id="tab-active-shares"
              role="tab"
              aria-selected={activeTab === "active"}
              aria-controls="panel-shares"
              onClick={() => setActiveTab("active")}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t
                ${activeTab === "active"
                  ? "border-accent text-accent"
                  : "border-transparent text-on-surface-muted hover:text-on-surface"}`}
            >
              Active
              {activeShares.length > 0 && (
                <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${activeTab === "active" ? "bg-accent/15 text-accent" : "bg-surface-high text-on-surface-muted"}`}>
                  {activeShares.length}
                </span>
              )}
            </button>
            <button
              id="tab-expired-shares"
              role="tab"
              aria-selected={activeTab === "expired"}
              aria-controls="panel-shares"
              onClick={() => setActiveTab("expired")}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t
                ${activeTab === "expired"
                  ? "border-accent text-accent"
                  : "border-transparent text-on-surface-muted hover:text-on-surface"}`}
            >
              Expired / Disabled
              {inactiveShares.length > 0 && (
                <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${activeTab === "expired" ? "bg-accent/15 text-accent" : "bg-surface-high text-on-surface-muted"}`}>
                  {inactiveShares.length}
                </span>
              )}
            </button>
          </div>

          <div
            id="panel-shares"
            role="tabpanel"
            aria-labelledby={activeTab === "active" ? "tab-active-shares" : "tab-expired-shares"}
          >
          {displayShares.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </div>
              <p className="text-sm text-on-surface-muted">
                {activeTab === "active" ? "No active share links." : "No expired or disabled links."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayShares.map((s) => {
                const active = !isExpired(s) && !s.disabled_at;
                return (
                  <div key={s.id} className="bg-surface rounded-lg border border-white/5 px-5 py-4 flex items-center gap-4 hover:border-white/10 transition-colors">
                    <div className="w-9 h-9 rounded-md bg-accent/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                        <polyline points="13 2 13 9 20 9"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/files/${s.file_id}`} className="text-sm font-medium text-on-surface hover:text-accent transition-colors truncate block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
                        {s.file_name}
                      </Link>
                      <p className="text-xs text-on-surface-muted mt-0.5">
                        Created {new Date(s.created_at).toLocaleDateString()} · Expires {new Date(s.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <ExpiryBadge share={s} />
                      {active && (
                        <button
                          onClick={() => handleDisable(s.id)}
                          className="text-xs text-on-surface-muted hover:text-error transition-colors px-2 py-1 rounded hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
                        >
                          Disable
                        </button>
                      )}
                    </div>
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

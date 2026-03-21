// audit log page — security event history with colour-coded action badges
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

interface AuditEntry {
  id: string;
  action: string;
  file_id: string | null;
  ip: string;
  user_agent: string;
  ts: string;
}

// colour-coded badges make it quicker to scan the log visually
const actionColors: Record<string, string> = {
  login: "text-success bg-success/10",
  logout: "text-on-surface-muted bg-surface-high",
  register: "text-blue-400 bg-blue-400/10",
  upload: "text-accent bg-accent/10",
  download: "text-purple-400 bg-purple-400/10",
  share_created: "text-teal-400 bg-teal-400/10",
  share_disabled: "text-warning bg-warning/10",
  share_accessed: "text-indigo-400 bg-indigo-400/10",
  login_failed: "text-error bg-error/10",
};

export default function AuditPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
    else if (user) fetchAudit();
  }, [user, authLoading, router]);

  async function fetchAudit() {
    try {
      const res = await api.getAudit(100, 0);
      setEntries(res.entries);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
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

  return (
    <div className="flex bg-primary">
      <Sidebar />
      <div className="main-with-sidebar">
        <header className="sticky top-0 z-20 bg-primary/80 backdrop-blur-sm border-b border-white/5 py-4">
          <div className="max-w-6xl mx-auto px-8">
            <h1 className="text-xl font-semibold text-on-surface">Audit Log</h1>
          </div>
        </header>

        <main className="py-8">
          <div className="max-w-6xl mx-auto px-8">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <p className="text-sm text-on-surface-muted">No audit entries yet.</p>
            </div>
          ) : (
            <div className="bg-surface rounded-lg border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Audit log entries">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th scope="col" className="py-3 px-5 text-left text-xs font-semibold text-on-surface-muted uppercase tracking-wider">Time</th>
                      <th scope="col" className="py-3 px-5 text-left text-xs font-semibold text-on-surface-muted uppercase tracking-wider">Action</th>
                      <th scope="col" className="py-3 px-5 text-left text-xs font-semibold text-on-surface-muted uppercase tracking-wider">File</th>
                      <th scope="col" className="py-3 px-5 text-left text-xs font-semibold text-on-surface-muted uppercase tracking-wider">IP</th>
                      <th scope="col" className="py-3 px-5 text-left text-xs font-semibold text-on-surface-muted uppercase tracking-wider">User Agent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {entries.map((e) => (
                      <tr key={e.id} className="hover:bg-surface-high transition-colors">
                        <td className="py-3 px-5 text-on-surface-muted whitespace-nowrap text-xs">
                          {new Date(e.ts).toLocaleString()}
                        </td>
                        <td className="py-3 px-5">
                          <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${actionColors[e.action] ?? "text-on-surface bg-surface-high"}`}>
                            {e.action}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-on-surface-muted">
                          {e.file_id ? (
                            <Link href={`/files/${e.file_id}`} className="text-accent hover:text-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded" aria-label={`View file ${e.file_id}`}>
                              {e.file_id.slice(0, 8)}…
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="py-3 px-5 text-on-surface-muted text-xs">{e.ip}</td>
                        <td className="py-3 px-5 text-on-surface-muted text-xs truncate max-w-[180px]">{e.user_agent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}

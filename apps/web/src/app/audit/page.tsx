// audit log page — shows the user's security event history: logins, uploads, shares, failures
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

interface AuditEntry {
  id: string;
  action: string;
  file_id: string | null;
  ip: string;
  user_agent: string;
  ts: string;
}

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // colour-coded badges make it quicker to scan the log visually
  const actionColors: Record<string, string> = {
    login: "text-green-700 bg-green-50",
    logout: "text-gray-600 bg-gray-100",
    register: "text-blue-700 bg-blue-50",
    upload: "text-brand-700 bg-brand-50",
    download: "text-purple-700 bg-purple-50",
    share_created: "text-teal-700 bg-teal-50",
    share_disabled: "text-orange-700 bg-orange-50",
    share_accessed: "text-indigo-700 bg-indigo-50",
    login_failed: "text-red-700 bg-red-50",
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-brand-600 hover:underline text-sm">
          &larr; Dashboard
        </Link>
        <h1 className="text-lg font-bold text-brand-600">VaultX</h1>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h2 className="text-xl font-semibold mb-4">Audit Log</h2>

        {entries.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No audit entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 px-3 font-medium">Time</th>
                  <th className="py-2 px-3 font-medium">Action</th>
                  <th className="py-2 px-3 font-medium">File</th>
                  <th className="py-2 px-3 font-medium">IP</th>
                  <th className="py-2 px-3 font-medium">User Agent</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                      {new Date(e.ts).toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          actionColors[e.action] || "text-gray-700 bg-gray-100"
                        }`}
                      >
                        {e.action}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">
                      {e.file_id ? (
                        <Link
                          href={`/files/${e.file_id}`}
                          className="text-brand-600 hover:underline"
                        >
                          {e.file_id.slice(0, 8)}...
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-500">{e.ip}</td>
                    <td className="py-2 px-3 text-gray-400 truncate max-w-[200px]">
                      {e.user_agent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

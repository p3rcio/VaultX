// shared links page — lists all share links created by the current user with status badges
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

interface Share {
  id: string;
  file_id: string;
  file_name: string;
  role: string;
  expires_at: string;
  created_at: string;
  disabled_at: string | null;
}

export default function SharedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);

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
      fetchShares(); // refresh the list after disabling
    } catch (err: any) {
      alert(err.message);
    }
  }

  // a share is expired if its expiry date is in the past
  function isExpired(s: Share): boolean {
    return new Date(s.expires_at) < new Date();
  }

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

      <main className="max-w-3xl mx-auto px-4 py-6">
        <h2 className="text-xl font-semibold mb-4">My Shared Links</h2>

        {shares.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            You haven&apos;t shared any files yet.
          </p>
        ) : (
          <div className="space-y-3">
            {shares.map((s) => {
              const expired = isExpired(s);
              const disabled = !!s.disabled_at;
              const active = !expired && !disabled;

              return (
                <div
                  key={s.id}
                  className="bg-white rounded-lg border p-4 flex items-center justify-between"
                >
                  <div>
                    <Link
                      href={`/files/${s.file_id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {s.file_name}
                    </Link>
                    <p className="text-xs text-gray-400 mt-1">
                      Created {new Date(s.created_at).toLocaleDateString()} · Expires{" "}
                      {new Date(s.expires_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* colour-coded badge so the status is obvious at a glance */}
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {disabled ? "Disabled" : expired ? "Expired" : "Active"}
                    </span>

                    {active && (
                      <button
                        onClick={() => handleDisable(s.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
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
      </main>
    </div>
  );
}

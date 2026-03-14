// dashboard — upload area and file list, includes auth guard redirect
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import FileUpload from "@/components/FileUpload";
import FileList from "@/components/FileList";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  // incrementing refreshKey tells FileList to re-fetch — used after a new upload finishes
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav bar */}
      <nav className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-brand-600">VaultX</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-brand-600 font-medium">
            Dashboard
          </Link>
          <Link href="/shared" className="text-gray-600 hover:text-brand-600">
            My Shares
          </Link>
          <Link href="/audit" className="text-gray-600 hover:text-brand-600">
            Audit Log
          </Link>
          <span className="text-gray-400">{user.email}</span>
          <button
            onClick={logout}
            className="text-red-600 hover:text-red-800 font-medium"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <h2 className="text-xl font-semibold">Upload Files</h2>
        {/* bump refreshKey when an upload finishes so FileList picks up the new entry */}
        <FileUpload onUploadComplete={() => setRefreshKey((k) => k + 1)} />

        <h2 className="text-xl font-semibold">My Files</h2>
        <FileList refreshKey={refreshKey} />
      </main>
    </div>
  );
}

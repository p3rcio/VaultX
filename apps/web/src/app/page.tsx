// root page — redirects to dashboard if logged in, login if not
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden="true" />
        <p className="text-on-surface-muted text-sm">Loading…</p>
      </div>
    </div>
  );
}

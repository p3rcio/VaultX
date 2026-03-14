// root page — redirects to dashboard if logged in, login page if not
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // wait for auth state to resolve before redirecting
    router.replace(user ? "/dashboard" : "/login");
  }, [user, loading, router]);

  // briefly shown while the auth context initialises
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400">Loading...</p>
    </div>
  );
}

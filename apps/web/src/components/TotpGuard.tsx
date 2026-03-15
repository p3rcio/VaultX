// redirects logged-in users who haven't set up 2FA to /setup-2fa
// runs on every navigation so they can't skip it by going directly to /dashboard
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// pages that don't need the 2FA check
const PUBLIC_PATHS = ["/login", "/register", "/setup-2fa"];
// pages that handle share links — accessed without an account
const SHARE_PREFIX = "/s/";

export function TotpGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return; // not logged in — other guards handle this
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;
    if (pathname.startsWith(SHARE_PREFIX)) return;

    // logged in but 2FA not yet set up → force them through setup
    if (!user.totp_enabled) {
      router.replace("/setup-2fa");
    }
  }, [user, loading, pathname, router]);

  return <>{children}</>;
}

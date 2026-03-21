"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const PUBLIC_PATHS = ["/login", "/register", "/setup-2fa"];
const SHARE_PREFIX = "/s/";

export function TotpGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;
    if (pathname.startsWith(SHARE_PREFIX)) return;

    if (!user.totp_enabled) {
      router.replace("/setup-2fa");
    }
  }, [user, loading, pathname, router]);

  return <>{children}</>;
}

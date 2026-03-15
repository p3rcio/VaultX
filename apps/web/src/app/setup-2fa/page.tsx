// 2FA setup page — shown after registration and any time totp_enabled is false
// user scans the QR code in their authenticator app then enters the first code to confirm
"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

export default function SetupTwoFAPage() {
  const { user, loading, refreshToken } = useAuth();
  const router = useRouter();

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // redirect away if already set up or not logged in
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.totp_enabled) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  // fetch QR code from the API as soon as the page loads
  useEffect(() => {
    if (loading || !user || user.totp_enabled) return;

    api.totpSetup()
      .then((res: any) => {
        setQrDataUrl(res.qr_data_url);
        setSecret(res.secret);
      })
      .catch((err: any) => {
        setFetchError(err.message || "Failed to generate QR code");
      });
  }, [user, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res: any = await api.totpActivate(code);
      // the server gives back a fresh JWT with totp_enabled: true
      refreshToken(res.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid code — check your app is synced");
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #111827 0%, #0A0F1E 70%)" }}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <div className="w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4 shadow-accent-glow">
            {/* shield icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">
            Set up <span className="text-accent">Two-Factor Auth</span>
          </h1>
          <p className="text-sm text-on-surface-muted mt-1 text-center">
            Protect your vault with an authenticator app
          </p>
        </div>

        <div className="bg-surface border border-white/8 rounded-xl shadow-elevation-3 p-8 space-y-6">
          {fetchError ? (
            <p className="text-error text-sm text-center">{fetchError}</p>
          ) : !qrDataUrl ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" aria-label="Loading" />
            </div>
          ) : (
            <>
              {/* Step 1 — scan */}
              <div>
                <p className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
                  Step 1 — Scan with your authenticator app
                </p>
                <div className="flex justify-center">
                  {/* white background so the QR code is readable on dark themes */}
                  <div className="rounded-lg overflow-hidden p-2 bg-white inline-block">
                    <img src={qrDataUrl} alt="TOTP QR code" width={180} height={180} />
                  </div>
                </div>
                {/* manual entry fallback */}
                {secret && (
                  <p className="text-xs text-on-surface-muted mt-3 text-center break-all">
                    Can't scan?{" "}
                    <span className="font-mono text-on-surface select-all">{secret}</span>
                  </p>
                )}
              </div>

              {/* Step 2 — verify */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="code" className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">
                    Step 2 — Enter the 6-digit code
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-surface-high border border-white/10 rounded-md px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors tracking-widest text-center text-lg font-mono"
                    placeholder="000000"
                  />
                </div>

                {error && (
                  <p className="text-error text-sm flex items-center gap-2" role="alert">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || code.length !== 6}
                  className="w-full bg-accent hover:bg-accent-hover text-white rounded-md px-5 py-2.5 text-sm font-medium transition-colors active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-surface shadow-accent-glow"
                >
                  {submitting ? "Activating…" : "Activate 2FA"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

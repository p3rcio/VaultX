"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

const EXPIRY_OPTIONS = [1, 3, 7, 14, 30];
const LOGOUT_OPTIONS = [5, 15, 30, 60, 120];

function labelLogout(m: number) {
  if (m < 60) return `${m} minutes`;
  return m === 60 ? "1 hour" : "2 hours";
}

type SaveStatus = "idle" | "saving" | "saved" | "error";
type Theme = "dark" | "light";

function getStoredTheme(): Theme {
  try {
    const t = localStorage.getItem("vaultx_theme");
    return t === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
  try {
    localStorage.setItem("vaultx_theme", theme);
  } catch {}
}

function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const isLight = theme === "light";

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => onChange("dark")}
        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent w-28 ${
          !isLight
            ? "border-accent bg-accent/10"
            : "border-white/10 hover:border-white/20 bg-transparent"
        }`}
        aria-pressed={!isLight}
        aria-label="Dark theme"
      >
        <div className="w-full h-14 rounded-md overflow-hidden border border-white/10" style={{ background: "#0A0F1E" }}>
          <div className="h-3 w-full" style={{ background: "#111827", borderBottom: "1px solid rgba(255,255,255,0.06)" }} />
          <div className="p-1.5 flex flex-col gap-1">
            <div className="h-1.5 rounded-full w-3/4" style={{ background: "#1E2A3B" }} />
            <div className="h-1.5 rounded-full w-1/2" style={{ background: "#1E2A3B" }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <span className="text-xs font-medium text-on-surface">Dark</span>
        </div>
        {!isLight && (
          <span className="text-xs text-accent font-semibold">Active</span>
        )}
      </button>

      <button
        onClick={() => onChange("light")}
        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent w-28 ${
          isLight
            ? "border-accent bg-accent/10"
            : "border-white/10 hover:border-white/20 bg-transparent"
        }`}
        aria-pressed={isLight}
        aria-label="Light theme"
      >
        <div className="w-full h-14 rounded-md overflow-hidden border border-black/10" style={{ background: "#F0F4FF" }}>
          <div className="h-3 w-full" style={{ background: "#FFFFFF", borderBottom: "1px solid #e2e8f0" }} />
          <div className="p-1.5 flex flex-col gap-1">
            <div className="h-1.5 rounded-full w-3/4" style={{ background: "#e2e8f0" }} />
            <div className="h-1.5 rounded-full w-1/2" style={{ background: "#e2e8f0" }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <span className="text-xs font-medium text-on-surface">Light</span>
        </div>
        {isLight && (
          <span className="text-xs text-accent font-semibold">Active</span>
        )}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [theme, setTheme] = useState<Theme>("dark");
  const [shareExpiry, setShareExpiry] = useState(7);
  const [logoutMins, setLogoutMins] = useState(30);
  const [pageLoading, setPageLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    setTheme(getStoredTheme());

    api.getPreferences()
      .then((res: any) => {
        const p = res.preferences;
        const expiry = p.default_share_expiry_days ?? 7;
        const logout = p.auto_logout_minutes ?? 30;
        setShareExpiry(expiry);
        setLogoutMins(logout);
        localStorage.setItem("vaultx_share_expiry_days", String(expiry));
        localStorage.setItem("vaultx_auto_logout_minutes", String(logout));
      })
      .catch(() => {
        const e = localStorage.getItem("vaultx_share_expiry_days");
        const l = localStorage.getItem("vaultx_auto_logout_minutes");
        if (e) setShareExpiry(parseInt(e, 10));
        if (l) setLogoutMins(parseInt(l, 10));
      })
      .finally(() => {
        setPageLoading(false);
        setTimeout(() => { initialised.current = true; }, 0);
      });
  }, [user]);

  const save = useCallback(async (expiry: number, logout: number) => {
    setSaveStatus("saving");
    setErrorMsg("");
    try {
      await api.updatePreferences({
        default_share_expiry_days: expiry,
        auto_logout_minutes: logout,
      });
      localStorage.setItem("vaultx_share_expiry_days", String(expiry));
      localStorage.setItem("vaultx_auto_logout_minutes", String(logout));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save");
      setSaveStatus("error");
    }
  }, []);

  function scheduleSave(expiry: number, logout: number) {
    if (!initialised.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(expiry, logout), 600);
  }

  function handleExpiryChange(val: number) {
    setShareExpiry(val);
    scheduleSave(val, logoutMins);
  }

  function handleLogoutChange(val: number) {
    setLogoutMins(val);
    scheduleSave(shareExpiry, val);
  }

  function handleThemeChange(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  if (authLoading || pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden="true" />
          <p className="text-on-surface-muted text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-primary">
      <Sidebar />

      <div className="main-with-sidebar flex flex-col">
        <header className="sticky top-0 z-20 bg-primary/80 backdrop-blur-sm border-b border-white/5 py-4">
          <div className="max-w-2xl mx-auto px-8 flex items-center justify-between">
            <h1 className="text-base font-semibold text-on-surface">Settings</h1>

            <div className="flex items-center gap-2 text-sm min-w-[90px] justify-end">
              {saveStatus === "saving" && (
                <span className="text-on-surface-muted flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border border-on-surface-muted border-t-transparent animate-spin" aria-hidden="true" />
                  Saving…
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="text-success flex items-center gap-1.5" role="status">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Saved
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-error text-xs" role="alert">{errorMsg}</span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 py-8">
          <div className="max-w-2xl mx-auto px-8 space-y-6">

            <p className="text-sm text-on-surface-muted">Changes are saved automatically.</p>

            <section className="bg-surface border border-white/10 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-on-surface">Appearance</h2>
                <p className="text-xs text-on-surface-muted mt-0.5">Choose how VaultX looks. Your preference is saved in this browser.</p>
              </div>
              <ThemeToggle theme={theme} onChange={handleThemeChange} />
            </section>

            <section className="bg-surface border border-white/10 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-on-surface">Sharing</h2>
                <p className="text-xs text-on-surface-muted mt-0.5">Default settings used when you create a new share link.</p>
              </div>

              <div>
                <label htmlFor="share-expiry" className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">
                  Default link expiry
                </label>
                <select
                  id="share-expiry"
                  value={shareExpiry}
                  onChange={(e) => handleExpiryChange(Number(e.target.value))}
                  className="w-full bg-surface-high border border-white/10 rounded-md px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                >
                  {EXPIRY_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>
                  ))}
                </select>
                <p className="text-xs text-on-surface-muted mt-1.5">
                  The Share dialog will pre-select this value when you create a new link.
                </p>
              </div>
            </section>

            <section className="bg-surface border border-white/10 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-on-surface">Security</h2>
                <p className="text-xs text-on-surface-muted mt-0.5">Automatic logout after a period of inactivity.</p>
              </div>

              <div>
                <label htmlFor="logout-timeout" className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">
                  Auto logout after inactivity
                </label>
                <select
                  id="logout-timeout"
                  value={logoutMins}
                  onChange={(e) => handleLogoutChange(Number(e.target.value))}
                  className="w-full bg-surface-high border border-white/10 rounded-md px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                >
                  {LOGOUT_OPTIONS.map((m) => (
                    <option key={m} value={m}>{labelLogout(m)}</option>
                  ))}
                </select>
                <p className="text-xs text-on-surface-muted mt-1.5">
                  You will be automatically logged out if the app is idle for this long.
                </p>
              </div>
            </section>

            <section className="bg-surface border border-white/10 rounded-xl p-6">
              <h2 className="text-base font-semibold text-on-surface mb-1">Account</h2>
              <p className="text-xs text-on-surface-muted mb-4">
                Update your display name, change your password, and manage your profile.
              </p>
              <Link
                href="/account"
                className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent-hover font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                Go to My Account
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            </section>

            <section className="bg-surface border border-error/30 rounded-xl p-6">
              <h2 className="text-base font-semibold text-error mb-1">Danger zone</h2>
              <p className="text-xs text-on-surface-muted mb-4">
                Permanently delete your account and all your files. This cannot be undone.
              </p>
              <Link
                href="/account#danger"
                className="inline-flex items-center gap-2 text-sm text-error hover:text-error/80 font-medium border border-error/40 hover:border-error/70 px-4 py-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                Delete my account
              </Link>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}

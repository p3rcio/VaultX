// registration page — same gradient as login, adds a password strength bar
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

// password strength: returns 0-4 based on criteria
function passwordStrength(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
  return score;
}

const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["bg-on-surface-muted/30", "bg-error", "bg-warning", "bg-accent", "bg-success"];
const strengthTextColor = ["text-on-surface-muted", "text-error", "text-warning", "text-accent", "text-success"];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = password ? passwordStrength(password) : -1;

  // client-side check before hitting the API
  function validate(): string | null {
    if (password.length < 12) return "Password must be at least 12 characters.";
    if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least 1 special character.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      await register(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #111827 0%, #0A0F1E 70%)" }}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <div className="w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4 shadow-accent-glow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">
            Create your <span className="text-accent">VaultX</span> account
          </h1>
          <p className="text-sm text-on-surface-muted mt-1">End-to-end encrypted from day one</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-white/8 rounded-xl shadow-elevation-3 p-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-high border border-white/10 rounded-md px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-high border border-white/10 rounded-md px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder="Min 12 chars, 1 special character"
            />
            {/* Password strength bar */}
            {password && (
              <div className="mt-2 space-y-1" aria-live="polite" aria-label={`Password strength: ${strengthLabel[strength + 1] ?? "Unknown"}`}>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${strength >= 0 && i <= strength ? strengthColor[strength] : "bg-on-surface-muted/20"}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className={`text-xs ${strengthTextColor[strength] ?? "text-on-surface-muted"}`}>
                  {strength >= 0 ? strengthLabel[strength] : ""}
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirm" className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`w-full bg-surface-high border rounded-md px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:ring-1 transition-colors
                ${confirm && confirm !== password
                  ? "border-error focus:border-error focus:ring-error"
                  : "border-white/10 focus:border-accent focus:ring-accent"}`}
              placeholder="Re-enter password"
            />
            {confirm && confirm !== password && (
              <p className="text-error text-xs mt-1">Passwords do not match</p>
            )}
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
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-white rounded-md px-5 py-2.5 text-sm font-medium transition-colors active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-surface shadow-accent-glow"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-on-surface-muted mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:text-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

// ShareDialog.tsx — modal for creating share links, full zero-knowledge key wrapping flow
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  generateShareSecret,
  hashShareToken,
  wrapFileKeyForShare,
  unwrapFileKey,
} from "@/lib/crypto";

interface Props {
  fileId: string;
  wrappedKey: string;
  onClose: () => void;
  onCreated?: () => void;
}

export default function ShareDialog({ fileId, wrappedKey, onClose, onCreated }: Props) {
  const { umk } = useAuth();

  // read the user's saved default expiry from localStorage (set in Settings page)
  function getDefaultDays(): number {
    try {
      const saved = localStorage.getItem("vaultx_share_expiry_days");
      const n = saved ? parseInt(saved, 10) : 7;
      return [1, 3, 7, 14, 30].includes(n) ? n : 7;
    } catch {
      return 7;
    }
  }

  const [days, setDays] = useState(() => getDefaultDays());
  const [shareUrl, setShareUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!umk) return;
    setLoading(true);
    setError("");
    try {
      // step 1: recover the file key using the user's master key
      const fileKey = await unwrapFileKey(wrappedKey, umk);
      // step 2: generate a random 32-byte secret for the share URL
      const { raw, token } = generateShareSecret();
      // step 3: wrap the file key with the share secret
      const wrappedForShare = await wrapFileKeyForShare(fileKey, raw);
      // step 4: hash the secret — DB stores hash, never the raw token
      const tokenHash = await hashShareToken(raw);
      // step 5: save the share record to the server
      await api.createShare(fileId, {
        file_id: fileId,
        wrapped_key_for_share: wrappedForShare,
        expires_in_days: days,
        link_token_hash: tokenHash,
      });
      // step 6: the raw token lives in the URL only — anyone with this link can decrypt
      setShareUrl(`${window.location.origin}/s/${token}`);
      onCreated?.();
    } catch (err: any) {
      setError(err.message || "Failed to create share link");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const dialogRef = useRef<HTMLDivElement>(null);

  // focus trap + escape handler — keeps Tab cycling inside the dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // put focus on the first interactive element when the dialog opens or content changes
    const first = dialog.querySelector<HTMLElement>(
      "select, input, button, [href], textarea, [tabindex]:not([tabindex=\"-1\"])"
    );
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;

      const focusable = dialog!.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
      );
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, shareUrl]);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="bg-surface border border-white/10 rounded-xl shadow-elevation-3 p-6 w-full max-w-md"
        role="dialog"
        aria-label="Create share link"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-on-surface">Share File</h2>
          <button
            onClick={onClose}
            className="text-on-surface-muted hover:text-on-surface p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Close dialog"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {!shareUrl ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">
                Link expires in
              </label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full bg-surface-high border border-white/10 rounded-md px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              >
                {[1, 3, 7, 14, 30].map((d) => (
                  <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-error text-sm flex items-center gap-2" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 bg-accent hover:bg-accent-hover text-white rounded-md px-5 py-2.5 text-sm font-medium transition-colors active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-surface"
              >
                {loading ? "Creating…" : "Create Link"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm text-on-surface-muted hover:text-on-surface hover:bg-surface-high rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-success/10 border border-success/20 rounded-md px-4 py-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p className="text-sm text-success">Share link created — expires in {days} day{days > 1 ? "s" : ""}</p>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 bg-surface-high border border-white/10 rounded-md px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                aria-label="Share URL"
              />
              <button
                onClick={handleCopy}
                className="bg-accent hover:bg-accent-hover text-white rounded-md px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-surface"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full text-center text-sm text-on-surface-muted hover:text-on-surface transition-colors py-2 rounded-md hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ShareDialog.tsx — modal for creating share links, handles the full zero-knowledge key wrapping flow
"use client";

import { useState } from "react";
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
  wrappedKey: string; // file key wrapped with the owner's UMK
  onClose: () => void;
  onCreated?: () => void;
}

export default function ShareDialog({ fileId, wrappedKey, onClose, onCreated }: Props) {
  const { umk } = useAuth();
  const [days, setDays] = useState(7);
  const [shareUrl, setShareUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!umk) return;
    setLoading(true);
    setError("");

    try {
      // step 1: recover the file key by unwrapping it with the user's master key
      const fileKey = await unwrapFileKey(wrappedKey, umk);

      // step 2: generate a random 32-byte secret — this is what goes in the share URL
      const { raw, token } = generateShareSecret();

      // step 3: wrap the file key with the share secret so the recipient can decrypt the file
      const wrappedForShare = await wrapFileKeyForShare(fileKey, raw);

      // step 4: hash the secret before sending to the server — DB stores hash, never the raw token
      const tokenHash = await hashShareToken(raw);

      // step 5: save the share record — server gets the hash + wrapped key but not the raw secret
      await api.createShare(fileId, {
        file_id: fileId,
        wrapped_key_for_share: wrappedForShare,
        expires_in_days: days,
        link_token_hash: tokenHash,
      });

      // step 6: the raw token lives in the URL only — anyone with the link can decrypt
      const url = `${window.location.origin}/s/${token}`;
      setShareUrl(url);
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
        role="dialog"
        aria-label="Create share link"
      >
        <h2 className="text-lg font-semibold mb-4">Share File</h2>

        {!shareUrl ? (
          <>
            <label className="block text-sm font-medium mb-1">
              Link expires in
            </label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {[1, 3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  {d} day{d > 1 ? "s" : ""}
                </option>
              ))}
            </select>

            {error && (
              <p className="text-red-600 text-sm mb-3">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Creating..." : "Create Link"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-2">
              Share link created! Anyone with this link can download the file for{" "}
              {days} day{days > 1 ? "s" : ""}.
            </p>

            <div className="flex gap-2 mb-4">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50"
                aria-label="Share URL"
              />
              <button
                onClick={handleCopy}
                className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full text-center text-sm text-gray-600 hover:text-gray-800"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}

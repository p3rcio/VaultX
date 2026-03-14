// account page — display name, password change, and permanent account deletion
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { deriveKEK, wrapUMK, generateSalt, toBase64 } from "@/lib/crypto";
import Sidebar from "@/components/Sidebar";

const KDF_ITERATIONS = 600_000;
const DELETE_PHRASE = "Yes, delete my account";

interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export default function AccountPage() {
  const { user, umk, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // display name
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState("");

  // change password
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState("");

  // delete account
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
    else if (user) fetchProfile();
  }, [user, authLoading, router]);

  async function fetchProfile() {
    try {
      const res = await api.getMe();
      setProfile(res.user);
      setNameInput(res.user.display_name ?? "");
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveName() {
    setNameSaving(true);
    setNameError("");
    setNameSuccess(false);
    try {
      const res = await api.updateDisplayName(nameInput);
      setProfile(res.user);
      setEditingName(false);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err: any) {
      setNameError(err.message);
    } finally {
      setNameSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!umk) return;
    if (newPwd !== confirmPwd) { setPwdError("New passwords don't match"); return; }
    if (newPwd.length < 12) { setPwdError("New password must be at least 12 characters"); return; }
    setPwdSaving(true);
    setPwdError("");
    setPwdSuccess(false);
    try {
      // re-wrap the existing UMK under a fresh KEK derived from the new password
      // the server never sees the plaintext UMK or either KEK
      const newSalt = generateSalt();
      const newKek = await deriveKEK(newPwd, newSalt, KDF_ITERATIONS);
      const newWrappedUmk = await wrapUMK(umk, newKek);
      await api.changePassword({
        current_password: currentPwd,
        new_password: newPwd,
        new_wrapped_umk: newWrappedUmk,
        new_kdf_salt: toBase64(newSalt),
        new_kdf_iterations: KDF_ITERATIONS,
      });
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setPwdSuccess(true);
      setTimeout(() => setPwdSuccess(false), 4000);
    } catch (err: any) {
      setPwdError(err.message);
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteText !== DELETE_PHRASE) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteAccount();
      // logout clears the JWT and UMK from session
      await logout();
    } catch (err: any) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden="true" />
          <p className="text-on-surface-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const initial = (profile?.display_name || user?.email || "?")[0].toUpperCase();
  const displayedName = profile?.display_name || user?.email?.split("@")[0] || "";

  return (
    <div className="flex bg-primary">
      <Sidebar />

      <div className="main-with-sidebar">
        <header className="sticky top-0 z-20 bg-primary/80 backdrop-blur-sm border-b border-white/5 py-4">
          <div className="max-w-3xl mx-auto px-8 flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-on-surface-muted hover:text-on-surface text-sm transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Dashboard
            </Link>
            <svg width="14" height="14" className="text-on-surface-muted/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span className="text-sm text-on-surface">My Account</span>
          </div>
        </header>

        <main className="py-8">
          <div className="max-w-3xl mx-auto px-8 space-y-6">

            {/* Profile card */}
            <div className="bg-surface rounded-lg border border-white/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-on-surface">Profile</h2>
              </div>
              <div className="p-6 space-y-5">
                {/* Avatar + summary */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center text-accent text-xl font-bold flex-shrink-0" aria-hidden="true">
                    {initial}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-on-surface">{displayedName}</p>
                    <p className="text-sm text-on-surface-muted">{profile?.email || user?.email}</p>
                    {profile?.created_at && (
                      <p className="text-xs text-on-surface-muted mt-0.5">
                        Member since {new Date(profile.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Display name */}
                <div>
                  <p className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">Display Name</p>
                  {editingName ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                        maxLength={100}
                        autoFocus
                        className="flex-1 bg-surface-high border border-white/10 rounded-md px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                        aria-label="Display name"
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={nameSaving}
                        className="bg-accent hover:bg-accent-hover text-white rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {nameSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditingName(false); setNameInput(profile?.display_name ?? ""); setNameError(""); }}
                        className="px-4 py-2 text-sm text-on-surface-muted hover:text-on-surface hover:bg-surface-high rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-on-surface">
                        {profile?.display_name || <span className="text-on-surface-muted italic">Not set</span>}
                      </span>
                      <button
                        onClick={() => setEditingName(true)}
                        className="text-xs text-accent hover:text-accent-hover font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                  {nameError && <p className="text-error text-xs mt-1.5">{nameError}</p>}
                  {nameSuccess && <p className="text-success text-xs mt-1.5">Display name updated.</p>}
                </div>

                {/* Email (read-only) */}
                <div>
                  <p className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">Email Address</p>
                  <p className="text-sm text-on-surface">{profile?.email || user?.email}</p>
                  <p className="text-xs text-on-surface-muted mt-1">Email address can't be changed.</p>
                </div>
              </div>
            </div>

            {/* Change password card */}
            <div className="bg-surface rounded-lg border border-white/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-on-surface">Change Password</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2" htmlFor="current-pwd">
                    Current Password
                  </label>
                  <input
                    id="current-pwd"
                    type="password"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    className="w-full bg-surface-high border border-white/10 rounded-md px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2" htmlFor="new-pwd">
                    New Password
                  </label>
                  <input
                    id="new-pwd"
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="w-full bg-surface-high border border-white/10 rounded-md px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                    placeholder="Minimum 12 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2" htmlFor="confirm-pwd">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-pwd"
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleChangePassword(); }}
                    className="w-full bg-surface-high border border-white/10 rounded-md px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                    placeholder="Repeat new password"
                  />
                </div>

                {pwdError && (
                  <p className="text-error text-sm flex items-center gap-2" role="alert">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {pwdError}
                  </p>
                )}
                {pwdSuccess && (
                  <div className="bg-success/10 border border-success/20 rounded-md px-4 py-3 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <p className="text-success text-sm">Password changed successfully.</p>
                  </div>
                )}

                <button
                  onClick={handleChangePassword}
                  disabled={pwdSaving || !currentPwd || !newPwd || !confirmPwd}
                  className="bg-accent hover:bg-accent-hover text-white rounded-md px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-surface"
                >
                  {pwdSaving ? "Updating…" : "Update Password"}
                </button>
              </div>
            </div>

            {/* Danger zone */}
            <div id="danger" className="bg-surface rounded-lg border border-error/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-error/20">
                <h2 className="text-sm font-semibold text-error">Danger Zone</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-medium text-on-surface mb-1">Permanently delete account</p>
                  <p className="text-xs text-on-surface-muted leading-relaxed">
                    Deletes your account, all uploaded files from storage, all share links, and all tags. This cannot be undone.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2" htmlFor="delete-confirm">
                    Type <span className="text-error font-mono normal-case tracking-normal">Yes, delete my account</span> to confirm
                  </label>
                  <input
                    id="delete-confirm"
                    type="text"
                    value={deleteText}
                    onChange={(e) => setDeleteText(e.target.value)}
                    className="w-full bg-surface-high border border-white/10 rounded-md px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-error focus:ring-1 focus:ring-error transition-colors"
                    placeholder="Yes, delete my account"
                    aria-label="Type the confirmation phrase to enable deletion"
                  />
                </div>

                {deleteError && <p className="text-error text-sm" role="alert">{deleteError}</p>}

                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteText !== DELETE_PHRASE || deleting}
                  className="bg-error hover:bg-error/80 text-white rounded-md px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-error focus-visible:ring-offset-surface"
                >
                  {deleting ? "Deleting account…" : "Delete My Account"}
                </button>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

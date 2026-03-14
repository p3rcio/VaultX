// shared TypeScript types used by both the API and the web app
// keeping them here means both sides stay in sync automatically

/* ── User ─────────────────────────────────────────────── */

export interface User {
  id: string;
  email: string;
  display_name?: string | null;
  created_at: string;
}

// returned on login so the client can re-derive the KEK and unwrap the UMK
export interface KeyBundle {
  wrapped_umk: string;   // base64
  kdf_salt: string;      // base64
  kdf_iterations: number;
}

/* ── Files ────────────────────────────────────────────── */

export type FileStatus = "pending" | "uploading" | "complete" | "failed";

export interface FileMeta {
  id: string;
  owner_id: string;
  name: string;
  size: number;
  mime: string;
  total_chunks: number;
  chunks_uploaded: number;
  status: FileStatus;
  version: number;
  created_at: string;
  deleted_at: string | null;
}

export interface FileKeyRecord {
  file_id: string;
  wrapped_key: string;  // base64 — file key wrapped with owner UMK, server can't decrypt this
  algo: string;
}

/* ── Upload ───────────────────────────────────────────── */

export interface InitUploadRequest {
  name: string;
  size: number;
  mime: string;
  total_chunks: number;
  wrapped_key: string;   // base64 — file key wrapped with the UMK
}

export interface InitUploadResponse {
  file_id: string;
  upload_urls: { index: number; url: string }[];
}

// returned when resuming a partial upload — indicates which chunks are already in S3
export interface ResumeUploadResponse {
  upload_urls: { index: number; url: string }[];
  chunks_uploaded: number[];
}

/* ── Download ─────────────────────────────────────────── */

// everything the client needs to fetch and decrypt the file
export interface DownloadPlan {
  file: FileMeta;
  wrapped_key: string;
  download_urls: { index: number; url: string }[];
}

/* ── Shares ───────────────────────────────────────────── */

export interface ShareRecord {
  id: string;
  file_id: string;
  file_name: string;
  role: string;
  expires_at: string;
  created_at: string;
  disabled_at: string | null;
}

export interface CreateShareRequest {
  file_id: string;
  wrapped_key_for_share: string; // file key re-wrapped with the share secret
  expires_in_days: number;       // 1–30
}

export interface ShareDownloadPlan {
  file: FileMeta;
  wrapped_key_for_share: string;
  download_urls: { index: number; url: string }[];
}

/* ── Tags ─────────────────────────────────────────────── */

export interface Tag {
  id: string;
  name: string;
}

export interface FileTag {
  tag_id: string;
  tag_name: string;
  confidence: number; // 0.0 to 1.0
}

export interface SetTagsRequest {
  tags: { name: string; confidence: number }[];
}

/* ── Audit ────────────────────────────────────────────── */

// every key action in the app gets logged with one of these action strings
export type AuditAction =
  | "register"
  | "login"
  | "logout"
  | "login_failed"
  | "upload"
  | "download"
  | "share_created"
  | "share_disabled"
  | "share_accessed"
  | "password_changed"
  | "account_deleted";

export interface AuditEntry {
  id: string;
  user_id: string | null; // null for unauthenticated actions like share_accessed
  action: AuditAction;
  file_id: string | null;
  ip: string;
  user_agent: string;
  ts: string;
}

/* ── Auth ─────────────────────────────────────────────── */

export interface RegisterRequest {
  email: string;
  password: string;
  wrapped_umk: string;
  kdf_salt: string;
  kdf_iterations: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  key_bundle: KeyBundle;
}

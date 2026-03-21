export interface User {
  id: string;
  email: string;
  display_name?: string | null;
  created_at: string;
  totp_enabled: boolean;
}

export interface KeyBundle {
  wrapped_umk: string;
  kdf_salt: string;
  kdf_iterations: number;
}

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
  wrapped_key: string;
  algo: string;
}

export interface InitUploadRequest {
  name: string;
  size: number;
  mime: string;
  total_chunks: number;
  wrapped_key: string;
}

export interface InitUploadResponse {
  file_id: string;
  upload_urls: { index: number; url: string }[];
}

export interface ResumeUploadResponse {
  upload_urls: { index: number; url: string }[];
  chunks_uploaded: number[];
}

export interface DownloadPlan {
  file: FileMeta;
  wrapped_key: string;
  download_urls: { index: number; url: string }[];
}

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
  wrapped_key_for_share: string;
  expires_in_days: number;
}

export interface ShareDownloadPlan {
  file: FileMeta;
  wrapped_key_for_share: string;
  download_urls: { index: number; url: string }[];
}

export interface Tag {
  id: string;
  name: string;
}

export interface FileTag {
  tag_id: string;
  tag_name: string;
  confidence: number;
}

export interface SetTagsRequest {
  tags: { name: string; confidence: number }[];
}

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
  | "account_deleted"
  | "2fa_enabled"
  | "2fa_disabled";

export interface AuditEntry {
  id: string;
  user_id: string | null;
  action: AuditAction;
  file_id: string | null;
  ip: string;
  user_agent: string;
  ts: string;
}

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

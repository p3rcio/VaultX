// thin HTTP client for all API calls — handles JWT headers and error responses

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_KEY = "vaultx_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null; // Next.js runs server-side too, avoid SSR errors
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// every request goes through here so the JWT gets attached automatically
async function request<T = any>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
  });

  const body = await res.json().catch(() => ({})); // empty body just becomes {}

  if (!res.ok) {
    const msg = body.error || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }

  return body as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/* ── Auth ─────────────────────────────────────────────── */

export const api = {
  register: (body: any) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: any) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request("/auth/logout", { method: "POST" }),

  /* Files */
  initUpload: (body: any) => request("/files/init", { method: "POST", body: JSON.stringify(body) }),
  getUploadUrls: (fileId: string) => request(`/files/${fileId}/upload-urls`, { method: "POST" }),
  completeUpload: (fileId: string) => request(`/files/${fileId}/complete`, { method: "POST" }),
  listFiles: (q?: string, tag?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    return request(`/files?${params}`);
  },
  getFile: (id: string) => request(`/files/${id}`),
  downloadFile: (id: string) => request(`/files/${id}/download`),
  deleteFile: (id: string) => request(`/files/${id}`, { method: "DELETE" }),

  /* Tags */
  setTags: (fileId: string, tags: { name: string; confidence: number }[]) =>
    request(`/files/${fileId}/tags`, { method: "POST", body: JSON.stringify({ tags }) }),
  removeTag: (fileId: string, tagId: string) =>
    request(`/files/${fileId}/tags/${tagId}`, { method: "DELETE" }),

  /* Shares */
  createShare: (fileId: string, body: any) =>
    request(`/shares/${fileId}/share`, { method: "POST", body: JSON.stringify(body) }),
  getShareByToken: (hash: string) => request(`/shares/by-token/${hash}`),
  listMyShares: () => request("/shares/mine"),
  getSharedWithMe: () => request("/shares/shared-with-me"),
  disableShare: (id: string) => request(`/shares/${id}`, { method: "DELETE" }),

  /* Audit */
  getAudit: (limit = 50, offset = 0) =>
    request(`/audit?limit=${limit}&offset=${offset}`),

  /* Users */
  getMe: () => request("/users/me"),
  updateDisplayName: (displayName: string) =>
    request("/users/me", { method: "PATCH", body: JSON.stringify({ display_name: displayName }) }),
  changePassword: (body: {
    current_password: string;
    new_password: string;
    new_wrapped_umk: string;
    new_kdf_salt: string;
    new_kdf_iterations: number;
  }) => request("/users/me/change-password", { method: "POST", body: JSON.stringify(body) }),
  deleteAccount: () => request("/users/me", { method: "DELETE" }),
  getPreferences: () => request("/users/me/preferences"),
  updatePreferences: (body: { default_share_expiry_days?: number; auto_logout_minutes?: number }) =>
    request("/users/me/preferences", { method: "PATCH", body: JSON.stringify(body) }),
};

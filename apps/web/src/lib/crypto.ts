// all client-side crypto using the Web Crypto API
// key hierarchy: password → PBKDF2 → KEK → wraps UMK → wraps per-file key
// the server never sees plaintext keys or file content at any point

// 600k iterations is the OWASP recommendation for PBKDF2-SHA256
// more iterations = harder to brute force offline, adds ~300ms to login which is acceptable
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 32;
const IV_BYTES = 12; // GCM needs a 12-byte IV (96 bits) — standard recommended size
const KEY_BITS = 256;

/* ── Helpers ──────────────────────────────────────────── */

// switched to a loop because the spread version (String.fromCharCode(...bytes)) crashes on large files
// it exceeds the JS call stack limit when the array is big enough
export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// base64url swaps + and / for - and _ so the value can go in a URL without encoding
export function toBase64Url(buf: ArrayBuffer): string {
  return toBase64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(s: string): ArrayBuffer {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "="; // pad to a multiple of 4
  return fromBase64(b64);
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n)); // cryptographically secure, not Math.random
}

/* ── KEK derivation (from password) ──────────────────── */

// PBKDF2 turns a password into a key — the salt means two identical passwords produce different KEKs
export async function deriveKEK(
  password: string,
  salt: ArrayBuffer,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  // Web Crypto needs the password as "key material" before it can derive from it
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-KW", length: KEY_BITS },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

/* ── UMK generation & wrapping ───────────────────────── */

export function generateSalt(): ArrayBuffer {
  return randomBytes(SALT_BYTES).buffer;
}

// the UMK is generated once at registration and kept separate from the password
// changing passwords only requires re-wrapping the UMK — no need to re-encrypt every file
export async function generateUMK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-KW", length: KEY_BITS },
    true, // must be extractable so it can be wrapped and stored
    ["wrapKey", "unwrapKey"]
  );
}

// the zero-knowledge part — UMK is encrypted with the KEK before sending to the server
// server stores the wrapped version but can't do anything with it without the user's password
export async function wrapUMK(
  umk: CryptoKey,
  kek: CryptoKey
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey("raw", umk, kek, "AES-KW");
  return toBase64(wrapped);
}

// on login, re-derive the KEK and use it to unwrap the UMK
// wrong password → wrong KEK → unwrapKey throws
export async function unwrapUMK(
  wrappedB64: string,
  kek: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    fromBase64(wrappedB64),
    kek,
    "AES-KW",
    { name: "AES-KW", length: KEY_BITS },
    true, // extractable so it can be stored in sessionStorage
    ["wrapKey", "unwrapKey"]
  );
}

/* ── Per-file key generation & wrapping ──────────────── */

// each file gets its own random key — compromising one file key doesn't affect any others
export async function generateFileKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: KEY_BITS },
    true, // extractable so it can be wrapped before storing on the server
    ["encrypt", "decrypt"]
  );
}

// file key is wrapped with the UMK before going to the server
export async function wrapFileKey(
  fileKey: CryptoKey,
  umk: CryptoKey
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey("raw", fileKey, umk, "AES-KW");
  return toBase64(wrapped);
}

export async function unwrapFileKey(
  wrappedB64: string,
  umk: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    fromBase64(wrappedB64),
    umk,
    "AES-KW",
    { name: "AES-GCM", length: KEY_BITS }, // file key is AES-GCM, not AES-KW
    true,
    ["encrypt", "decrypt"]
  );
}

/* ── Share key wrapping (token-derived) ──────────────── */

// sharing without breaking zero-knowledge was the trickiest part to get right
// the idea: generate a random secret, put it in the URL, wrap the file key with it
// server only stores a hash of the secret so a DB leak doesn't expose the share links
export function generateShareSecret(): { raw: Uint8Array; token: string } {
  const raw = randomBytes(32);
  return { raw, token: toBase64Url(raw.buffer) };
}

// SHA-256 hash of the token is stored in the DB instead of the raw token
// someone with DB access can't reconstruct valid share URLs from the hash
export async function hashShareToken(raw: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // hex string
}

// turns raw secret bytes into a proper CryptoKey for AES-KW operations
async function importShareKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-KW", length: KEY_BITS },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

export async function wrapFileKeyForShare(
  fileKey: CryptoKey,
  shareRaw: Uint8Array
): Promise<string> {
  const shareKey = await importShareKey(shareRaw);
  const wrapped = await crypto.subtle.wrapKey("raw", fileKey, shareKey, "AES-KW");
  return toBase64(wrapped);
}

// used on the public share page — takes the token from the URL and unwraps the file key
// the recipient doesn't need an account, just the URL
export async function unwrapFileKeyFromShare(
  wrappedB64: string,
  shareRaw: Uint8Array
): Promise<CryptoKey> {
  const shareKey = await importShareKey(shareRaw);
  return crypto.subtle.unwrapKey(
    "raw",
    fromBase64(wrappedB64),
    shareKey,
    "AES-KW",
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"]
  );
}

/* ── Chunk encryption / decryption (AES-GCM) ────────── */

// AES-GCM also verifies integrity — tampered ciphertext causes decryption to fail rather than return garbage
// each chunk gets a fresh random IV — reusing IVs with GCM is catastrophically insecure
export async function encryptChunk(
  plaintext: ArrayBuffer,
  fileKey: CryptoKey
): Promise<ArrayBuffer> {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    fileKey,
    plaintext
  );

  // prepend IV so decryption knows what to use
  // layout: [12 bytes IV | ciphertext | 16 bytes auth tag]
  const result = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_BYTES);
  return result.buffer;
}

export async function decryptChunk(
  data: ArrayBuffer,
  fileKey: CryptoKey
): Promise<ArrayBuffer> {
  const iv = new Uint8Array(data, 0, IV_BYTES); // first 12 bytes are the IV
  const ciphertext = new Uint8Array(data, IV_BYTES);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, fileKey, ciphertext);
}

/* ── UMK session persistence ─────────────────────────── */

const UMK_SESSION_KEY = "vaultx_umk";

// sessionStorage clears when the tab closes — don't want the master key sitting around indefinitely
// it does survive page refreshes within the same tab, which is what's needed
export async function storeUMKInSession(umk: CryptoKey): Promise<void> {
  // CryptoKey objects can't be stored directly — export to raw bytes first
  const raw = await crypto.subtle.exportKey("raw", umk);
  sessionStorage.setItem(UMK_SESSION_KEY, toBase64(raw));
}

export async function loadUMKFromSession(): Promise<CryptoKey | null> {
  const b64 = sessionStorage.getItem(UMK_SESSION_KEY);
  if (!b64) return null;

  return crypto.subtle.importKey(
    "raw",
    fromBase64(b64),
    { name: "AES-KW", length: KEY_BITS },
    true,
    ["wrapKey", "unwrapKey"]
  );
}

export function clearUMKFromSession(): void {
  sessionStorage.removeItem(UMK_SESSION_KEY);
}

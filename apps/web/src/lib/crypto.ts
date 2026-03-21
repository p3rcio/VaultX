const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 32;
const IV_BYTES = 12;
const KEY_BITS = 256;

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

export function toBase64Url(buf: ArrayBuffer): string {
  return toBase64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(s: string): ArrayBuffer {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  return fromBase64(b64);
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function deriveKEK(
  password: string,
  salt: ArrayBuffer,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const enc = new TextEncoder();
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

export function generateSalt(): ArrayBuffer {
  return randomBytes(SALT_BYTES).buffer;
}

export async function generateUMK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-KW", length: KEY_BITS },
    true,
    ["wrapKey", "unwrapKey"]
  );
}

export async function wrapUMK(
  umk: CryptoKey,
  kek: CryptoKey
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey("raw", umk, kek, "AES-KW");
  return toBase64(wrapped);
}

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
    true,
    ["wrapKey", "unwrapKey"]
  );
}

export async function generateFileKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: KEY_BITS },
    true,
    ["encrypt", "decrypt"]
  );
}

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
    { name: "AES-GCM", length: KEY_BITS },
    true,
    ["encrypt", "decrypt"]
  );
}

export function generateShareSecret(): { raw: Uint8Array<ArrayBuffer>; token: string } {
  const raw = randomBytes(32);
  return { raw, token: toBase64Url(raw.buffer) };
}

export async function hashShareToken(raw: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function importShareKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
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
  shareRaw: Uint8Array<ArrayBuffer>
): Promise<string> {
  const shareKey = await importShareKey(shareRaw);
  const wrapped = await crypto.subtle.wrapKey("raw", fileKey, shareKey, "AES-KW");
  return toBase64(wrapped);
}

export async function unwrapFileKeyFromShare(
  wrappedB64: string,
  shareRaw: Uint8Array<ArrayBuffer>
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

  const result = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_BYTES);
  return result.buffer;
}

export async function decryptChunk(
  data: ArrayBuffer,
  fileKey: CryptoKey
): Promise<ArrayBuffer> {
  const iv = new Uint8Array(data, 0, IV_BYTES);
  const ciphertext = new Uint8Array(data, IV_BYTES);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, fileKey, ciphertext);
}

const UMK_SESSION_KEY = "vaultx_umk";

export async function storeUMKInSession(umk: CryptoKey): Promise<void> {
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

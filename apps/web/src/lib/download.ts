import { decryptChunk, unwrapFileKey, unwrapFileKeyFromShare } from "./crypto";
import { fromBase64Url } from "./crypto";
import { api } from "./api";

export interface DownloadProgress {
  totalChunks: number;
  completedChunks: number;
  status: "downloading" | "decrypting" | "complete" | "failed";
  error?: string;
}

type ProgressCallback = (p: DownloadProgress) => void;

export async function downloadOwnFile(
  fileId: string,
  umk: CryptoKey,
  onProgress?: ProgressCallback
): Promise<void> {
  const data = await api.downloadFile(fileId);
  const fileKey = await unwrapFileKey(data.wrapped_key, umk);
  await downloadAndDecrypt(data.file, data.download_urls, fileKey, onProgress);
}

export async function downloadSharedFile(
  tokenB64Url: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const raw = new Uint8Array(fromBase64Url(tokenB64Url));

  const hashBuf = await crypto.subtle.digest("SHA-256", raw);
  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const data = await api.getShareByToken(hashHex);
  const fileKey = await unwrapFileKeyFromShare(data.wrapped_key_for_share, raw);
  await downloadAndDecrypt(data.file, data.download_urls, fileKey, onProgress);
}

async function downloadAndDecrypt(
  file: { name: string; size: number; mime: string; total_chunks: number },
  downloadUrls: { index: number; url: string }[],
  fileKey: CryptoKey,
  onProgress?: ProgressCallback
): Promise<void> {
  const progress: DownloadProgress = {
    totalChunks: file.total_chunks,
    completedChunks: 0,
    status: "downloading",
  };

  const emit = () => onProgress?.({ ...progress });
  emit();

  const sorted = [...downloadUrls].sort((a, b) => a.index - b.index);
  const decryptedChunks: ArrayBuffer[] = [];

  for (const { url } of sorted) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const encrypted = await res.arrayBuffer();

    progress.status = "decrypting";
    emit();

    const plaintext = await decryptChunk(encrypted, fileKey);
    decryptedChunks.push(plaintext);

    progress.completedChunks++;
    progress.status = "downloading";
    emit();
  }

  const blob = new Blob(decryptedChunks, { type: file.mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  progress.status = "complete";
  emit();
}

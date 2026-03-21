import {
  generateFileKey,
  wrapFileKey,
  encryptChunk,
} from "./crypto";
import { api } from "./api";
import {
  fileFingerprint,
  getUploadRecord,
  saveUploadRecord,
  deleteUploadRecord,
  UploadRecord,
} from "./indexeddb";

export const CHUNK_SIZE = 5 * 1024 * 1024;

export type UploadStatus = "queued" | "uploading" | "paused" | "completed" | "failed";

export interface UploadProgress {
  fileId: string;
  fileName: string;
  status: UploadStatus;
  totalChunks: number;
  completedChunks: number;
  bytesUploaded: number;
  totalBytes: number;
  error?: string;
}

type ProgressCallback = (progress: UploadProgress) => void;

export async function uploadFile(
  file: File,
  umk: CryptoKey,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal,
  customName?: string
): Promise<string> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
  const fp = fileFingerprint(file);

  const progress: UploadProgress = {
    fileId: "",
    fileName: customName ?? file.name,
    status: "queued",
    totalChunks,
    completedChunks: 0,
    bytesUploaded: 0,
    totalBytes: file.size,
  };

  const emit = () => onProgress({ ...progress });

  try {
    let record = await getUploadRecord(fp);
    let fileId: string;
    let uploadUrls: { index: number; url: string }[];
    let completedSet: Set<number>;

    if (record) {
      fileId = record.fileId;
      const res = await api.getUploadUrls(fileId);
      uploadUrls = res.upload_urls;
      completedSet = new Set<number>(res.chunks_uploaded ?? []);
      progress.completedChunks = completedSet.size;
      progress.bytesUploaded = completedSet.size * CHUNK_SIZE;
    } else {
      const fileKey = await generateFileKey();
      const wrappedKey = await wrapFileKey(fileKey, umk);

      const res = await api.initUpload({
        name: customName ?? file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        total_chunks: totalChunks,
        wrapped_key: wrappedKey,
      });

      fileId = res.file_id;
      uploadUrls = res.upload_urls;
      completedSet = new Set<number>();

      record = { fingerprint: fp, fileId, totalChunks, completedChunks: [] };
      await saveUploadRecord(record);

      const rawKey = await crypto.subtle.exportKey("raw", fileKey);
      sessionStorage.setItem(`vaultx_fk_${fileId}`, btoa(String.fromCharCode(...new Uint8Array(rawKey))));
    }

    progress.fileId = fileId;
    progress.status = "uploading";
    emit();

    const fkB64 = sessionStorage.getItem(`vaultx_fk_${fileId}`);
    if (!fkB64) throw new Error("File key not found in session — cannot resume encryption");
    const fkRaw = Uint8Array.from(atob(fkB64), (c) => c.charCodeAt(0));
    const fileKey = await crypto.subtle.importKey(
      "raw",
      fkRaw,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    for (const { index, url } of uploadUrls) {
      if (completedSet.has(index)) continue;

      if (abortSignal?.aborted) {
        progress.status = "paused";
        emit();
        return fileId;
      }

      await waitForOnline();

      const start = index * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const plaintext = await file.slice(start, end).arrayBuffer();

      const encrypted = await encryptChunk(plaintext, fileKey);

      const putRes = await fetch(url, {
        method: "PUT",
        body: encrypted,
        headers: { "Content-Type": "application/octet-stream" },
      });

      if (!putRes.ok) {
        throw new Error(`Chunk ${index} upload failed: ${putRes.status}`);
      }

      completedSet.add(index);
      progress.completedChunks = completedSet.size;
      progress.bytesUploaded = Math.min(completedSet.size * CHUNK_SIZE, file.size);
      emit();

      await saveUploadRecord({
        fingerprint: fp,
        fileId,
        totalChunks,
        completedChunks: Array.from(completedSet),
      });
    }

    await api.completeUpload(fileId);
    progress.status = "completed";
    emit();

    await deleteUploadRecord(fp);
    sessionStorage.removeItem(`vaultx_fk_${fileId}`);

    return fileId;
  } catch (err: any) {
    progress.status = "failed";
    progress.error = err.message;
    emit();
    throw err;
  }
}

function waitForOnline(): Promise<void> {
  return new Promise((resolve) => {
    if (navigator.onLine) {
      resolve();
      return;
    }

    const start = Date.now();
    const handler = () => {
      window.removeEventListener("online", handler);
      if (Date.now() - start > 10_000) {
        console.log("[upload] Was offline >10s, resuming...");
      }
      resolve();
    };
    window.addEventListener("online", handler);
  });
}

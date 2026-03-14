// upload.ts — chunked encrypted file upload with progress tracking, resume via IndexedDB, and offline detection
// flow: generate a file key → encrypt each 5MB chunk → upload via presigned URLs
// IndexedDB tracks which chunks finished so the upload can resume after a page refresh
// if the browser goes offline for >10s the upload pauses and waits for connectivity

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

export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB — the minimum part size for S3 multipart uploads

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
  abortSignal?: AbortSignal
): Promise<string> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
  const fp = fileFingerprint(file);

  const progress: UploadProgress = {
    fileId: "",
    fileName: file.name,
    status: "queued",
    totalChunks,
    completedChunks: 0,
    bytesUploaded: 0,
    totalBytes: file.size,
  };

  const emit = () => onProgress({ ...progress });

  try {
    // fingerprint uses name+size+lastModified to identify the same file across page refreshes
    let record = await getUploadRecord(fp);
    let fileId: string;
    let uploadUrls: { index: number; url: string }[];
    let completedSet: Set<number>;

    if (record) {
      // resuming — get fresh presigned URLs since the old ones will have expired
      fileId = record.fileId;
      completedSet = new Set(record.completedChunks);
      const res = await api.getUploadUrls(fileId);
      uploadUrls = res.upload_urls;
      progress.completedChunks = completedSet.size;
      progress.bytesUploaded = completedSet.size * CHUNK_SIZE;
    } else {
      // new upload — generate a file key and wrap it before the API ever sees it
      const fileKey = await generateFileKey();
      const wrappedKey = await wrapFileKey(fileKey, umk);

      const res = await api.initUpload({
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        total_chunks: totalChunks,
        wrapped_key: wrappedKey, // server stores this but can't use it without the UMK
      });

      fileId = res.file_id;
      uploadUrls = res.upload_urls;
      completedSet = new Set<number>();

      // save to IndexedDB so the upload can be resumed if the page closes mid-way
      record = { fingerprint: fp, fileId, totalChunks, completedChunks: [] };
      await saveUploadRecord(record);

      // stash the raw file key in sessionStorage so each chunk can be encrypted
      const rawKey = await crypto.subtle.exportKey("raw", fileKey);
      sessionStorage.setItem(`vaultx_fk_${fileId}`, btoa(String.fromCharCode(...new Uint8Array(rawKey))));
    }

    progress.fileId = fileId;
    progress.status = "uploading";
    emit();

    // pull the file key back out of session so it can encrypt each chunk
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
      if (completedSet.has(index)) continue; // chunk already uploaded, skip it

      if (abortSignal?.aborted) {
        progress.status = "paused";
        emit();
        return fileId;
      }

      // if offline, block here until the connection comes back
      await waitForOnline();

      const start = index * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const plaintext = await file.slice(start, end).arrayBuffer();

      // encrypt before uploading — the server only ever sees ciphertext
      const encrypted = await encryptChunk(plaintext, fileKey);

      // upload directly to MinIO via the presigned URL, the API server never touches the bytes
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

      // persist progress after every chunk in case the page closes between chunks
      await saveUploadRecord({
        fingerprint: fp,
        fileId,
        totalChunks,
        completedChunks: Array.from(completedSet),
      });
    }

    // notify the API that all chunks are in S3 so it can mark the file as complete
    await api.completeUpload(fileId);
    progress.status = "completed";
    emit();

    // clean up resume state — no longer needed
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

/* ── Offline detection helper ────────────────────────── */

function waitForOnline(): Promise<void> {
  return new Promise((resolve) => {
    if (navigator.onLine) {
      resolve();
      return;
    }

    // offline — block here and wait for the browser to report connectivity again
    const start = Date.now();
    const handler = () => {
      window.removeEventListener("online", handler);
      // log if the outage exceeded 10s — the spec requires pausing uploads in that case
      if (Date.now() - start > 10_000) {
        console.log("[upload] Was offline >10s, resuming...");
      }
      resolve();
    };
    window.addEventListener("online", handler);
  });
}

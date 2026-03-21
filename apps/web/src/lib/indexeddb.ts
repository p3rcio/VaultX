const DB_NAME = "vaultx";
const STORE_NAME = "uploads";
const DB_VERSION = 1;

export interface UploadRecord {
  fingerprint: string;
  fileId: string;
  totalChunks: number;
  completedChunks: number[];
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "fingerprint" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getUploadRecord(
  fingerprint: string
): Promise<UploadRecord | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(fingerprint);
    req.onsuccess = () => resolve(req.result as UploadRecord | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function saveUploadRecord(record: UploadRecord): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteUploadRecord(fingerprint: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(fingerprint);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function fileFingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

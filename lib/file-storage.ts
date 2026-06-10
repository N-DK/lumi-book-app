const DB_NAME = "lumi-file-storage";
const STORE_NAME = "files";
const DB_VERSION = 1;

function openFileDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Không mở được IndexedDB."));
  });
}

export async function putStoredFile(key: string, file: Blob) {
  const db = await openFileDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(file, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Không lưu được file."));
    };
  });
}

export async function getStoredFile(key: string) {
  const db = await openFileDb();

  return new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);

    request.onsuccess = () => {
      const value = request.result;
      resolve(value instanceof Blob ? value : undefined);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Không đọc được file đã lưu."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Không đọc được file đã lưu."));
    };
  });
}

export function dataUrlToBlob(dataUrl: string) {
  const [header, data] = dataUrl.split(",");
  if (!header || !data) throw new Error("Data URL không hợp lệ.");

  const match = header.match(/^data:([^;]+)?(;base64)?/);
  const type = match?.[1] ?? "";
  const binary = match?.[2]
    ? atob(data)
    : decodeURIComponent(data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type });
}

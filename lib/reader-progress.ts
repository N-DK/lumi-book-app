import type { Book } from "@/lib/lumi-data";

export const READER_PROGRESS_STORAGE_KEY = "lumi:reader-progress:v1";
export const READER_PROGRESS_CHANGE_EVENT = "lumi:reader-progress-change";

type StoredReaderProgress =
  | number
  | {
      page?: unknown;
      total?: unknown;
    };

export interface ReaderProgress {
  page: number;
  total: number;
  exists: boolean;
}

function readProgressMap() {
  if (typeof localStorage === "undefined") return {};

  try {
    const raw = localStorage.getItem(READER_PROGRESS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, StoredReaderProgress>)
      : {};
  } catch {
    return {};
  }
}

function clampPage(page: number, total: number) {
  if (!Number.isFinite(page)) return 0;
  if (total <= 0) return Math.max(0, Math.floor(page));
  return Math.min(Math.max(Math.floor(page), 0), Math.max(0, total - 1));
}

export function getBookReaderKey(book: Pick<Book, "id" | "kind">) {
  if (book.kind === "pdf") return `pdf-${book.id}`;
  if (book.kind === "epub") return `epub-${book.id}`;
  return book.id;
}

export function getSampleBookPageTotal(book: Pick<Book, "chapters" | "kind">) {
  if (book.kind !== "sample") return 0;
  return (
    book.chapters?.reduce(
      (total, chapter) => total + chapter.paragraphs.length,
      0,
    ) ?? 0
  );
}

export function readReaderProgress(
  readerKey: string,
  fallbackTotal = 0,
): ReaderProgress {
  const entry = readProgressMap()[readerKey];
  const exists = typeof entry !== "undefined";

  if (typeof entry === "number") {
    return {
      page: clampPage(entry, fallbackTotal),
      total: Math.max(0, fallbackTotal),
      exists,
    };
  }

  const page =
    entry && typeof entry === "object" && Number.isFinite(entry.page)
      ? Number(entry.page)
      : 0;
  const total =
    entry && typeof entry === "object" && Number.isFinite(entry.total)
      ? Number(entry.total)
      : fallbackTotal;

  return {
    page: clampPage(page, total),
    total: Math.max(0, Math.floor(total)),
    exists,
  };
}

export function readSavedReaderPage(readerKey: string, total: number) {
  return readReaderProgress(readerKey, total).page;
}

export function saveReaderProgress(
  readerKey: string,
  page: number,
  total: number,
) {
  if (typeof localStorage === "undefined") return;

  try {
    const progress = readProgressMap();
    progress[readerKey] = {
      page: clampPage(page, total),
      total: Math.max(0, Math.floor(total)),
    };
    localStorage.setItem(
      READER_PROGRESS_STORAGE_KEY,
      JSON.stringify(progress),
    );
    window.dispatchEvent(new Event(READER_PROGRESS_CHANGE_EVENT));
  } catch (error) {
    console.warn("Không lưu được tiến độ đọc.", error);
  }
}

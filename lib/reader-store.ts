export type StoredReaderThemeKey = "midnight" | "sepia" | "paper";
export type StoredReaderMode = "scroll" | "page";

export interface StoredReaderState {
  bookId: string;
  currentPage: number;
  totalPages: number;
  currentChapter?: string;
  fontSize: number;
  mode: StoredReaderMode;
  themeKey: StoredReaderThemeKey;
  updatedAt: number;
}

const readerStates = new Map<string, StoredReaderState>();
const readerPageCache = new Map<string, unknown>();
let activeReaderBookId: string | null = null;

export function getReaderState(bookId: string) {
  return readerStates.get(bookId) ?? null;
}

export function setActiveReaderBook(bookId: string | null) {
  activeReaderBookId = bookId;
}

export function getActiveReaderBookId() {
  return activeReaderBookId;
}

export function getReaderPageCache<T>(cacheKey: string) {
  return (readerPageCache.get(cacheKey) as T | undefined) ?? null;
}

export function setReaderPageCache<T>(cacheKey: string, pages: T) {
  readerPageCache.set(cacheKey, pages);
  return pages;
}

export function clearReaderPageCache(cacheKey?: string) {
  if (cacheKey) {
    readerPageCache.delete(cacheKey);
    return;
  }

  readerPageCache.clear();
}

export function updateReaderState(
  bookId: string,
  state: Partial<Omit<StoredReaderState, "bookId" | "updatedAt">>,
) {
  const current = readerStates.get(bookId);
  const next: StoredReaderState = {
    bookId,
    currentPage: 0,
    totalPages: 0,
    fontSize: 18,
    mode: "page",
    themeKey: "sepia",
    ...current,
    ...state,
    updatedAt: Date.now(),
  };
  readerStates.set(bookId, next);
  activeReaderBookId = bookId;
  return next;
}

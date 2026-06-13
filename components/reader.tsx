"use client";

import { ProgressSlider } from "@/components/progress-slider";
import type { Book } from "@/lib/lumi-data";
import { fadeIn, panelIn } from "@/lib/motion";
import {
  getReaderPageCache,
  getReaderState,
  setActiveReaderBook,
  setReaderPageCache,
  updateReaderState,
  type StoredReaderMode,
  type StoredReaderThemeKey,
} from "@/lib/reader-store";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Moon,
  Plus,
  RefreshCw,
  ScrollText,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import HTMLFlipBook from "react-pageflip";

interface ReaderProps {
  book: Book;
  onClose: () => void;
  onProgressChange?: (book: Book, progress: ReaderProgressUpdate) => void;
  isBookmarked?: boolean;
  isBookmarking?: boolean;
  onToggleBookmark?: (book: Book) => void;
}

export interface ReaderProgressUpdate {
  currentPage: number;
  totalPages: number;
  currentChapter?: string;
}

/* ---------- Reader themes (theo thiết kế LUMI) ---------- */
type ReaderThemeKey = StoredReaderThemeKey;
type ReaderMode = StoredReaderMode;

interface ReaderErrorState {
  title: string;
  message: string;
  canRetry: boolean;
}

interface BookFetchErrorPayload {
  code?: unknown;
  detail?: unknown;
  message?: unknown;
  retryable?: unknown;
  upstreamStatus?: unknown;
}

class BookFileFetchError extends Error {
  code?: string;
  detail?: string;
  retryable: boolean;
  status?: number;

  constructor(
    message: string,
    options: {
      code?: string;
      detail?: string;
      retryable?: boolean;
      status?: number;
    } = {},
  ) {
    super(message);
    this.name = "BookFileFetchError";
    this.code = options.code;
    this.detail = options.detail;
    this.retryable = options.retryable ?? true;
    this.status = options.status;
  }
}

interface ReaderTheme {
  label: string;
  icon: typeof Sun;
  bg: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  rule: string;
  pageBg: string;
  pageText: string;
  pageMuted: string;
  pageFold: string;
  pageFoldSoft: string;
  imageFilter: string;
}

const READER_THEMES: Record<ReaderThemeKey, ReaderTheme> = {
  midnight: {
    label: "Tối ấm",
    icon: Moon,
    bg: "#1a1410",
    text: "#e8dcc4",
    muted: "rgba(232,220,196,0.55)",
    accent: "#c9a876",
    accentText: "#1a1410",
    rule: "rgba(232,220,196,0.1)",
    pageBg: "#241b10",
    pageText: "#e8dcc4",
    pageMuted: "rgba(232,220,196,0.4)",
    pageFold: "rgba(217,185,138,0.16)",
    pageFoldSoft: "rgba(217,185,138,0.05)",
    imageFilter: "sepia(0.2) brightness(0.78) contrast(1.04)",
  },
  sepia: {
    label: "Giấy ngà",
    icon: BookOpen,
    bg: "#f1e4cb",
    text: "#3a2a1c",
    muted: "rgba(58,42,28,0.6)",
    accent: "#8a5a2b",
    accentText: "#f1e4cb",
    rule: "rgba(58,42,28,0.12)",
    pageBg: "#ead6ac",
    pageText: "#2a1b10",
    pageMuted: "rgba(42,27,16,0.4)",
    pageFold: "rgba(42,27,16,0.2)",
    pageFoldSoft: "rgba(42,27,16,0.06)",
    imageFilter: "sepia(0.14) brightness(0.96) contrast(1.02)",
  },
  paper: {
    label: "Trắng",
    icon: Sun,
    bg: "#fafaf7",
    text: "#1b1b1b",
    muted: "rgba(27,27,27,0.6)",
    accent: "#a07320",
    accentText: "#fafaf7",
    rule: "rgba(27,27,27,0.1)",
    pageBg: "#f7f2e8",
    pageText: "#1f1b15",
    pageMuted: "rgba(31,27,21,0.4)",
    pageFold: "rgba(31,27,21,0.14)",
    pageFoldSoft: "rgba(31,27,21,0.04)",
    imageFilter: "none",
  },
};

export function Reader({
  book,
  onClose,
  onProgressChange,
  isBookmarked = false,
  isBookmarking = false,
  onToggleBookmark,
}: ReaderProps) {
  const storedState = getReaderState(book.id);
  const [themeKey, setThemeKey] = useState<ReaderThemeKey>(
    () => storedState?.themeKey ?? "sepia",
  );
  const [mode, setMode] = useState<ReaderMode>(
    () => storedState?.mode ?? "page",
  );
  const [fontSize, setFontSize] = useState(() => storedState?.fontSize ?? 18);
  const [showSettings, setShowSettings] = useState(false);
  const lastPageRef = useRef<number | null>(null);
  const [pageInfo, setPageInfo] = useState({
    page: storedState?.currentPage ?? book.progress?.currentPage ?? 0,
    total: storedState?.totalPages ?? book.progress?.totalPages ?? 0,
  });

  const t = READER_THEMES[themeKey];
  const percent =
    pageInfo.total > 0
      ? Math.round(((pageInfo.page + 1) / pageInfo.total) * 100)
      : Math.min(100, Math.max(0, book.progress?.percent ?? 0));

  useEffect(() => {
    const saved = getReaderState(book.id);
    const page = saved?.currentPage ?? book.progress?.currentPage ?? 0;
    const total = saved?.totalPages ?? book.progress?.totalPages ?? 0;

    setActiveReaderBook(book.id);
    setThemeKey(saved?.themeKey ?? "sepia");
    setMode(saved?.mode ?? "page");
    setFontSize(saved?.fontSize ?? 18);
    lastPageRef.current = page;
    setPageInfo({ page, total });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      setActiveReaderBook(null);
    };
  }, [book.id, book.progress?.currentPage, book.progress?.totalPages, onClose]);

  useEffect(() => {
    updateReaderState(book.id, {
      currentPage: pageInfo.page,
      totalPages: pageInfo.total,
      currentChapter:
        getReaderState(book.id)?.currentChapter ??
        book.progress?.currentChapter ??
        "",
      fontSize,
      mode,
      themeKey,
    });
  }, [
    book.id,
    book.progress?.currentChapter,
    fontSize,
    mode,
    pageInfo.page,
    pageInfo.total,
    themeKey,
  ]);

  const handleProgress = useCallback(
    (currentPage: number, totalPages: number) => {
      lastPageRef.current = currentPage;
      setPageInfo({ page: currentPage, total: totalPages });
      updateReaderState(book.id, {
        currentPage,
        totalPages,
        fontSize,
        mode,
        themeKey,
      });
      onProgressChange?.(book, { currentPage, totalPages });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book.id, fontSize, mode, themeKey],
  );

  const initialPage = lastPageRef.current ?? pageInfo.page ?? 0;

  const bodyProps = {
    book,
    mode,
    t,
    fontSize,
    initialPage,
    onProgress: handleProgress,
  };

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="show"
      exit="exit"
      className="fixed inset-0 z-200 flex flex-col transition-colors duration-300"
      style={{ backgroundColor: t.bg, color: t.text }}
    >
      {/* Top bar */}
      <header
        className="shrink-0 border-b backdrop-blur-md"
        style={{ borderColor: t.rule }}
      >
        <div className="flex h-14 items-center gap-3 px-5 sm:px-8">
          <button
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full transition hover:bg-current/5"
            aria-label="Quay lại thư viện"
          >
            <ArrowLeft className="size-4" />
          </button>

          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] uppercase tracking-[0.18em]"
              style={{ color: t.muted }}
            >
              Đang đọc
            </p>
            <p className="truncate text-sm font-medium">
              {book.title} ·{" "}
              <span style={{ color: t.muted }}>{book.author}</span>
            </p>
          </div>

          <div className="flex items-center gap-1">
            {onToggleBookmark && (
              <label
                className={cn(
                  "ui-bookmark relative grid size-9 place-items-center rounded-full border transition hover:bg-current/5",
                  isBookmarked &&
                    "is-saved shadow-[0_8px_24px_rgba(0,0,0,0.16)]",
                  isBookmarking && "is-loading cursor-wait",
                )}
                style={
                  {
                    "--icon-secondary-color": t.text,
                    "--icon-hover-color": t.accent,
                    "--icon-primary-color": t.accent,
                    "--icon-circle-border": `1px solid ${t.accent}`,
                    borderColor: isBookmarked ? t.accent : t.rule,
                    backgroundColor: isBookmarked ? t.rule : "transparent",
                  } as CSSProperties
                }
                aria-label={isBookmarked ? "Bỏ lưu sách" : "Lưu sách"}
                aria-busy={isBookmarking}
              >
                <input
                  type="checkbox"
                  checked={isBookmarked}
                  disabled={isBookmarking}
                  onChange={() => onToggleBookmark(book)}
                />
                <span className="bookmark" aria-hidden="true">
                  <svg viewBox="0 0 32 32">
                    <g>
                      <path d="M27 4v27a1 1 0 0 1-1.625.781L16 24.281l-9.375 7.5A1 1 0 0 1 5 31V4a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4z" />
                    </g>
                  </svg>
                </span>
                {isBookmarking && (
                  <span
                    className="absolute inset-0 flex items-center justify-center rounded-full"
                    style={{ backgroundColor: t.bg, color: t.accent }}
                  >
                    <Loader2 className="size-4 animate-spin" />
                  </span>
                )}
              </label>
            )}
            <button
              onClick={() => setShowSettings((v) => !v)}
              className={cn(
                "grid size-9 place-items-center rounded-full transition hover:bg-current/5",
              )}
              style={
                showSettings
                  ? { backgroundColor: t.rule, color: t.accent }
                  : undefined
              }
              aria-label="Cài đặt đọc"
              aria-pressed={showSettings}
            >
              <Settings2 className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="grid size-9 place-items-center rounded-full transition hover:bg-current/5"
              aria-label="Đóng trình đọc"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* progress strip */}
        <div className="h-px" style={{ backgroundColor: t.rule }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="h-full transition-all"
            style={{ backgroundColor: t.accent }}
          />
        </div>
      </header>

      {/* Settings strip */}
      <AnimatePresence initial={false}>
        {showSettings && (
          <motion.div
            variants={panelIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className="shrink-0 border-b backdrop-blur"
            style={{ borderColor: t.rule }}
          >
            <div className="flex flex-wrap items-center gap-6 px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <span
                className="text-[10px] uppercase tracking-[0.2em]"
                style={{ color: t.muted }}
              >
                Cỡ chữ
              </span>
              <div
                className="flex items-center rounded-full border"
                style={{ borderColor: t.rule }}
              >
                <button
                  onClick={() => setFontSize((s) => Math.max(14, s - 1))}
                  className="grid size-8 place-items-center rounded-l-full hover:bg-current/5"
                  aria-label="Giảm cỡ chữ"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-10 px-3 text-center font-mono text-xs tabular-nums">
                  {fontSize}
                </span>
                <button
                  onClick={() => setFontSize((s) => Math.min(28, s + 1))}
                  className="grid size-8 place-items-center rounded-r-full hover:bg-current/5"
                  aria-label="Tăng cỡ chữ"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className="text-[10px] uppercase tracking-[0.2em]"
                style={{ color: t.muted }}
              >
                Nền
              </span>
              <div
                className="flex items-center rounded-full border p-0.5"
                style={{ borderColor: t.rule }}
              >
                {(Object.keys(READER_THEMES) as ReaderThemeKey[]).map((k) => {
                  const ThemeIcon = READER_THEMES[k].icon;
                  const active = k === themeKey;
                  return (
                    <button
                      key={k}
                      onClick={() => setThemeKey(k)}
                      className="flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium transition hover:bg-current/5"
                      style={
                        active
                          ? { backgroundColor: t.accent, color: t.accentText }
                          : undefined
                      }
                      aria-pressed={active}
                    >
                      <ThemeIcon className="size-3" />
                      {READER_THEMES[k].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className="text-[10px] uppercase tracking-[0.2em]"
                style={{ color: t.muted }}
              >
                Chế độ
              </span>
              <div
                className="flex items-center rounded-full border p-0.5"
                style={{ borderColor: t.rule }}
              >
                {(
                  [
                    { k: "scroll", l: "Cuộn", I: ScrollText },
                    { k: "page", l: "Lật trang", I: BookOpen },
                  ] as { k: ReaderMode; l: string; I: typeof BookOpen }[]
                ).map(({ k, l, I }) => {
                  const active = k === mode;
                  return (
                    <button
                      key={k}
                      onClick={() => setMode(k)}
                      className="flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium transition hover:bg-current/5"
                      style={
                        active
                          ? { backgroundColor: t.accent, color: t.accentText }
                          : undefined
                      }
                      aria-pressed={active}
                    >
                      <I className="size-3" />
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <motion.div
        key={book.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-0 flex-1"
      >
        {book.kind === "sample" && <SampleReader {...bodyProps} />}
        {book.kind === "pdf" && <PdfReader {...bodyProps} />}
        {book.kind === "epub" && <EpubReader {...bodyProps} />}
      </motion.div>
    </motion.div>
  );
}

/* ---------- Types ---------- */
type FlipPageData =
  | { kind: "text"; text: string; n: number }
  | { kind: "image"; src: string; alt: string; n: number }
  | { kind: "blank" };

type FlipOrientation = "portrait" | "landscape";

type PageFlipApi = {
  flipNext: (corner?: "top" | "bottom") => void;
  flipPrev: (corner?: "top" | "bottom") => void;
  turnToPage?: (page: number) => void;
};

type HTMLFlipBookRef = {
  pageFlip: () => PageFlipApi | undefined;
};

type FlipEvent = { data: unknown };

interface ReaderBodyProps {
  book: Book;
  mode: ReaderMode;
  t: ReaderTheme;
  fontSize: number;
  initialPage: number;
  onProgress: (currentPage: number, totalPages: number) => void;
}

const EPUB_PAGE_CHAR_LIMIT = 360;
const EPUB_PAGE_LINE_LIMIT = 13;
const EPUB_AVERAGE_LINE_CHARS = 40;
const PDF_MAX_RENDER_EDGE = 1300;
const PDF_WORKER_SRC = "/pdf.worker.min.mjs";
const OPEN_BOOK_FRAME = "/open_book.png";
const OPEN_BOOK_RATIO = 1600 / 1054;
const OPEN_BOOK_CONTENT = {
  left: 0.084,
  top: 0.072,
  width: 0.832,
  height: 0.82,
};

/* ---------- Helper Functions ---------- */
function getFlipPageIndex(data: unknown) {
  if (typeof data === "number") return data;
  if (typeof data === "string") {
    const parsed = Number(data);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (data && typeof data === "object" && "page" in data) {
    const page = (data as { page: unknown }).page;
    return typeof page === "number" ? page : null;
  }
  return null;
}

function getFlipOrientation(data: unknown): FlipOrientation | null {
  if (data === "portrait" || data === "landscape") return data;
  if (data && typeof data === "object" && "mode" in data) {
    const mode = (data as { mode: unknown }).mode;
    return mode === "portrait" || mode === "landscape" ? mode : null;
  }
  return null;
}

function clampPage(page: number, total: number) {
  if (!Number.isFinite(page)) return 0;
  if (total <= 0) return Math.max(0, Math.floor(page));
  return Math.min(Math.max(Math.floor(page), 0), Math.max(0, total - 1));
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function normalizeBookText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Lỗi không xác định";
}

function getReaderErrorState(error: unknown, fileType: "PDF" | "EPUB") {
  const isBookFileError = error instanceof BookFileFetchError;

  return {
    title: `Không đọc được ${fileType}`,
    message: getErrorMessage(error),
    canRetry: isBookFileError ? true : false,
  };
}

function chunkText(text: string, limit = EPUB_PAGE_CHAR_LIMIT) {
  const chunks: string[] = [];
  let remaining = normalizeBookText(text);

  while (remaining.length > limit) {
    const punctuationCuts = [
      ". ",
      "! ",
      "? ",
      "; ",
      ": ",
      "。",
      "！",
      "？",
    ].map((mark) => remaining.lastIndexOf(mark, limit));
    let cut = Math.max(...punctuationCuts);
    if (cut > 0) cut += 1;
    if (cut < limit * 0.55) cut = remaining.lastIndexOf(" ", limit);
    if (cut < limit * 0.55) cut = limit;

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function estimateRenderedLines(text: string) {
  return text.split("\n").reduce((count, line) => {
    const normalized = normalizeBookText(line);
    if (!normalized) return count + 1;
    return (
      count +
      Math.max(1, Math.ceil(normalized.length / EPUB_AVERAGE_LINE_CHARS))
    );
  }, 0);
}

function paginateTextBlocks(blocks: string[], limit = EPUB_PAGE_CHAR_LIMIT) {
  const pages: FlipPageData[] = [];
  let buffer = "";
  const pushBuffer = () => {
    const text = buffer.trim();
    if (!text) return;
    pages.push({ kind: "text", text, n: pages.length + 1 });
    buffer = "";
  };

  for (const block of blocks) {
    for (const piece of chunkText(block, limit)) {
      const next = buffer ? `${buffer}\n\n${piece}` : piece;
      if (
        buffer &&
        (next.length > limit ||
          estimateRenderedLines(next) > EPUB_PAGE_LINE_LIMIT)
      ) {
        pushBuffer();
        buffer = piece;
      } else {
        buffer = next;
      }
    }
  }

  pushBuffer();
  return pages;
}

function extractTextBlocks(root: ParentNode) {
  const body =
    root instanceof Document
      ? root.body
      : root instanceof Element
        ? (root.querySelector("body") ?? root)
        : root;
  const blockNodes =
    body instanceof Element
      ? Array.from(
          body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,blockquote,li,pre"),
        )
      : [];
  const blocks = blockNodes
    .map((node) => normalizeBookText(node.textContent ?? ""))
    .filter(
      (text, index, list) => text.length > 0 && list.indexOf(text) === index,
    );

  if (blocks.length > 0) return blocks;

  const fallback = normalizeBookText(body.textContent ?? "");
  return fallback ? [fallback] : [];
}

async function readBookArrayBuffer(book: Book) {
  if (!book.fileUrl) throw new Error("Missing book file");

  const response = await fetch(book.fileUrl, { credentials: "include" });
  if (!response.ok) throw await getBookFetchError(response);
  return response.arrayBuffer();
}

async function getBookFetchError(response: Response) {
  const fallback = `Không tải được file sách (${response.status}).`;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await response.json().catch(() => null)) as
      | BookFetchErrorPayload
      | null;
    const code = typeof data?.code === "string" ? data.code : undefined;
    const detail = typeof data?.detail === "string" ? data.detail : undefined;
    const status =
      typeof data?.upstreamStatus === "number"
        ? data.upstreamStatus
        : response.status;
    const retryable =
      typeof data?.retryable === "boolean" ? data.retryable : true;
    const message =
      typeof data?.message === "string" && data.message.trim()
        ? data.message
        : fallback;

    return new BookFileFetchError(message, {
      code,
      detail,
      retryable,
      status,
    });
  }

  const text = await response.text().catch(() => "");
  const cleanText = text.replace(/\s+/g, " ").trim();
  return new BookFileFetchError(cleanText ? cleanText.slice(0, 180) : fallback, {
    status: response.status,
  });
}

function getReaderPageCacheKey(book: Book, kind: "pdf" | "epub") {
  return `${kind}:${book.id}:${book.fileUrl ?? ""}`;
}

function resolveEpubAssetPath(opfPath: string, href: string) {
  const cleanHref = href.split("#")[0]?.split("?")[0] ?? href;
  const baseParts = opfPath.split("/").slice(0, -1);
  const parts = [...baseParts, ...cleanHref.split("/")];
  const resolved: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }

  return resolved.join("/");
}

function parseEpubDocument(markup: string) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(markup, "application/xhtml+xml");
  if (!xml.querySelector("parsererror")) return xml;
  return parser.parseFromString(markup, "text/html");
}

/* ---------- Reader body: chọn chế độ Cuộn / Lật trang ---------- */
function ReaderBody({
  book,
  pages,
  mode,
  t,
  fontSize,
  initialPage,
  onProgress,
}: ReaderBodyProps & { pages: FlipPageData[] }) {
  if (mode === "scroll") {
    return (
      <ScrollReader
        book={book}
        pages={pages}
        readerKey={book.id}
        initialPage={initialPage}
        fontSize={fontSize}
        t={t}
        onProgress={onProgress}
      />
    );
  }

  return (
    <BookFlipReader
      pages={pages}
      readerKey={book.id}
      initialPage={initialPage}
      t={t}
      onProgressChange={onProgress}
    />
  );
}

/* ---------- Footer chung (theo thiết kế) ---------- */
function ReaderFooter({
  t,
  page,
  total,
  percent,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onSeek,
}: {
  t: ReaderTheme;
  page: number;
  total: number;
  percent: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSeek?: (page: number) => void;
}) {
  return (
    <footer
      className="shrink-0 border-t backdrop-blur-md"
      style={{ borderColor: t.rule }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1720px] items-center gap-4 px-5 sm:px-8">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className="grid size-9 shrink-0 place-items-center rounded-full border transition hover:bg-current/5 disabled:cursor-not-allowed disabled:opacity-25"
          style={{ borderColor: t.rule }}
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="shrink-0 font-mono text-xs tabular-nums">
            {total > 0 ? page + 1 : 0}
          </span>
          <ProgressSlider
            min={0}
            max={Math.max(0, total - 1)}
            value={clampPage(page, total)}
            onChange={(value) => onSeek?.(value)}
            step={1}
            disabled={!onSeek || total === 0}
            className="flex-1"
            fillColor={t.accent}
            trackColor={t.rule}
            thumbColor={t.accent}
            ariaLabel="Tiến độ đọc"
            valueLabel={`${percent}%`}
          />
          <span
            className="shrink-0 font-mono text-xs tabular-nums"
            style={{ color: t.muted }}
          >
            {total}
          </span>
        </div>

        <div
          className="hidden shrink-0 items-center gap-2 text-xs sm:flex"
          style={{ color: t.muted }}
        >
          <span className="font-semibold" style={{ color: t.accent }}>
            {percent}%
          </span>
          <span>·</span>
          <span>
            Trang {total > 0 ? page + 1 : 0}/{total}
          </span>
        </div>

        <button
          onClick={onNext}
          disabled={!canNext}
          className="grid size-9 shrink-0 place-items-center rounded-full border transition hover:bg-current/5 disabled:cursor-not-allowed disabled:opacity-25"
          style={{ borderColor: t.rule }}
          aria-label="Trang sau"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </footer>
  );
}

/* ---------- Scroll Reader (chế độ Cuộn — theo thiết kế) ---------- */
function ScrollReader({
  book,
  pages,
  readerKey,
  initialPage,
  fontSize,
  t,
  onProgress,
}: {
  book: Book;
  pages: FlipPageData[];
  readerKey: string;
  initialPage: number;
  fontSize: number;
  t: ReaderTheme;
  onProgress: (currentPage: number, totalPages: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onProgressRef = useRef(onProgress);
  const total = pages.length;
  const [page, setPage] = useState(() => clampPage(initialPage, total));

  const percent = total > 0 ? Math.round(((page + 1) / total) * 100) : 0;

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  // Cuộn tới trang đã lưu khi mở (trang đầu thì giữ nguyên đầu trang)
  useEffect(() => {
    const start = clampPage(initialPage, total);
    const el = pageRefs.current[start];
    if (start > 0 && el && containerRef.current) {
      containerRef.current.scrollTop = el.offsetTop - 24;
    }
    if (total > 0) onProgressRef.current(start, total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerKey, total]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const goTo = useCallback(
    (n: number) => {
      const target = clampPage(n, total);
      const el = pageRefs.current[target];
      if (el && containerRef.current) {
        containerRef.current.scrollTo({
          top: el.offsetTop - 24,
          behavior: "smooth",
        });
      }
    },
    [total],
  );

  function handleScroll() {
    const c = containerRef.current;
    if (!c || total === 0) return;

    const probe = c.scrollTop + 80;
    let idx = 0;
    for (let i = 0; i < total; i++) {
      const el = pageRefs.current[i];
      if (el && el.offsetTop <= probe) idx = i;
      else if (el) break;
    }
    // chạm đáy = trang cuối
    if (c.scrollTop + c.clientHeight >= c.scrollHeight - 8) idx = total - 1;

    if (idx !== page) {
      setPage(idx);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(
        () => onProgressRef.current(idx, total),
        600,
      );
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey)
        return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goTo(page + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goTo(page - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, page]);

  return (
    <div className="flex h-full flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="lumi-scroll relative min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-3xl px-6 py-14 sm:px-10 sm:py-20">
          <p
            className="mb-4 text-[11px] uppercase tracking-[0.28em]"
            style={{ color: t.accent }}
          >
            {book.author}
          </p>
          <h1 className="mb-12 text-balance font-heading text-3xl font-semibold leading-tight sm:text-4xl">
            {book.title}
          </h1>

          <article
            className="space-y-7 text-pretty"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
          >
            {pages.map((pg, i) => {
              if (pg.kind === "text") {
                return (
                  <p
                    key={i}
                    ref={(el) => {
                      pageRefs.current[i] = el;
                    }}
                    className={cn(
                      "whitespace-pre-line",
                      i === 0 &&
                        "first-letter:float-left first-letter:mr-2 first-letter:font-heading first-letter:text-5xl first-letter:font-semibold first-letter:leading-[0.9]",
                    )}
                  >
                    {pg.text}
                  </p>
                );
              }
              if (pg.kind === "image") {
                return (
                  <img
                    key={i}
                    ref={(el) => {
                      pageRefs.current[i] = el;
                    }}
                    src={pg.src}
                    alt={pg.alt}
                    className="mx-auto w-full max-w-2xl rounded-sm shadow-lg"
                    draggable={false}
                  />
                );
              }
              return null;
            })}

            <div
              className="my-12 flex items-center gap-4"
              style={{ color: t.muted }}
            >
              <span className="h-px flex-1 bg-current/20" />
              <span className="text-xs tracking-[0.4em]">✦</span>
              <span className="h-px flex-1 bg-current/20" />
            </div>
          </article>
        </div>
      </div>

      <ReaderFooter
        t={t}
        page={page}
        total={total}
        percent={percent}
        canPrev={page > 0}
        canNext={page < total - 1}
        onPrev={() => goTo(page - 1)}
        onNext={() => goTo(page + 1)}
        onSeek={goTo}
      />
    </div>
  );
}

/* ---------- FlipPage với nếp gấp mềm mại ---------- */
const FlipPage = forwardRef<
  HTMLDivElement,
  {
    pg: FlipPageData;
    side: "left" | "right";
    t: ReaderTheme;
    pageNumber?: number;
  }
>(function FlipPage({ pg, side, t, pageNumber }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "lumi-open-book-page relative flex h-full w-full flex-col overflow-hidden",
        pg.kind === "image" && "p-0",
        pg.kind === "blank" && "items-center justify-center",
        pg.kind === "text" && "px-8 pb-14 pt-6 sm:px-11 sm:pb-16 sm:pt-8",
      )}
      style={
        {
          "--lumi-open-book-page-bg": t.pageBg,
          color: t.pageText,
          backgroundColor: t.pageBg,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
          boxShadow: `
          inset ${side === "left" ? "-7px" : "7px"} 0 12px -5px ${t.pageFold},
          inset ${side === "left" ? "-3px" : "3px"} 0 5px -2px ${t.pageFoldSoft}
        `,
        } as CSSProperties
      }
    >
      {/* Nếp gấp dọc – gradient mờ dần, không sọc */}
      <div
        className="pointer-events-none absolute inset-y-0 z-10"
        style={{
          [side === "left" ? "right" : "left"]: 0,
          width: "12px",
          background: `
            linear-gradient(
              to ${side === "left" ? "left" : "right"},
              ${t.pageFold} 0%,
              ${t.pageFoldSoft} 40%,
              transparent 100%
            )
          `,
        }}
      />

      {/* Số trang */}
      {pageNumber && pg.kind !== "blank" && (
        <div className="absolute bottom-3 left-0 right-0 text-center z-20">
          <span
            className="text-[10px] font-serif tracking-wider"
            style={{ color: t.pageMuted }}
          >
            — {pageNumber} —
          </span>
        </div>
      )}

      {/* Text content */}
      {pg.kind === "text" && (
        <div className="relative z-10">
          <p className="whitespace-pre-line font-serif text-[14px] leading-[1.75] tracking-[0.01em] sm:text-[15px]">
            {pg.text}
          </p>
        </div>
      )}

      {/* Image content */}
      {pg.kind === "image" && (
        <div className="h-full w-full flex items-center justify-center px-8 pb-14 pt-6 sm:px-10 sm:pb-16 sm:pt-8 z-10">
          <img
            src={pg.src}
            alt={pg.alt}
            className="max-h-full max-w-full object-contain"
            draggable={false}
            style={{
              filter: t.imageFilter,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          />
        </div>
      )}

      {/* Blank page */}
      {pg.kind === "blank" && (
        <div className="flex flex-col items-center gap-3 opacity-20 z-10">
          <span className="h-px w-16 bg-[#2c1810]" />
          <span className="h-px w-12 bg-[#2c1810]" />
        </div>
      )}
    </div>
  );
});
FlipPage.displayName = "FlipPage";

/* ---------- Sample Reader ---------- */
function SampleReader(props: ReaderBodyProps) {
  const pages = useMemo<FlipPageData[]>(() => {
    const result: FlipPageData[] = [];
    for (const ch of props.book.chapters ?? []) {
      ch.paragraphs.forEach((p) => {
        result.push({
          kind: "text",
          text: p,
          n: result.length + 1,
        });
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.book.id]);

  return <ReaderBody {...props} pages={pages} />;
}

/* ---------- Book Flip Reader (chế độ Lật trang) ---------- */
function BookFlipReader({
  pages,
  readerKey,
  initialPage = 0,
  t,
  onProgressChange,
}: {
  pages: FlipPageData[];
  readerKey: string;
  initialPage?: number;
  t: ReaderTheme;
  onProgressChange?: (currentPage: number, totalPages: number) => void;
}) {
  const { contentTotal, flipPages } = useMemo(() => {
    const result = [...pages];
    const contentTotal = result.length;
    if (result.length === 0) result.push({ kind: "blank" });
    if (result.length % 2 !== 0) result.push({ kind: "blank" });
    return { contentTotal, flipPages: result };
  }, [pages]);

  const flipRef = useRef<HTMLFlipBookRef | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onProgressChangeRef = useRef(onProgressChange);
  const clampedInitialPage = useMemo(
    () => clampPage(initialPage, contentTotal),
    [contentTotal, initialPage],
  );
  const [page, setPage] = useState(clampedInitialPage);
  const [orientation, setOrientation] = useState<FlipOrientation>("landscape");
  const [size, setSize] = useState({ width: 900, height: 717 });

  const isPortrait = orientation === "portrait";
  const spreadSize = isPortrait ? 1 : 2;
  const spreadStartIndex = isPortrait ? page : Math.floor(page / 2) * 2;
  const totalSpreads = Math.max(1, Math.ceil(contentTotal / spreadSize));
  const currentSpread =
    contentTotal > 0
      ? Math.min(totalSpreads, Math.floor(spreadStartIndex / spreadSize) + 1)
      : 0;
  const percent =
    contentTotal > 0 ? Math.round((currentSpread / totalSpreads) * 100) : 0;
  const canNext =
    contentTotal > 0 &&
    page <
      Math.max(
        0,
        Math.ceil(contentTotal / spreadSize) * spreadSize - spreadSize,
      );

  useEffect(() => {
    onProgressChangeRef.current = onProgressChange;
  }, [onProgressChange]);

  // Tính kích thước full container
  useEffect(() => {
    function calcSize() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const availableWidth = Math.max(320, rect.width - 48);
      const availableHeight = Math.max(280, rect.height - 96);
      const width = Math.min(
        availableWidth,
        availableHeight * OPEN_BOOK_RATIO,
        1280,
      );
      const height = width / OPEN_BOOK_RATIO;

      setSize({ width: Math.floor(width), height: Math.floor(height) });
    }

    calcSize();
    const observer = new ResizeObserver(calcSize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const playPageSound = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      void ctx.resume();

      const dur = 0.28;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length;
        const env = Math.exp(-t * 4) * (0.35 + 0.65 * Math.sin(t * 12));
        data[i] = (Math.random() * 2 - 1) * env * 0.5;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1500;
      filter.Q.value = 1;
      const gain = ctx.createGain();
      gain.gain.value = 0.1;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
    } catch {
      /* noop */
    }
  }, []);

  const syncState = useCallback(
    (e: FlipEvent) => {
      const nextPage = getFlipPageIndex(e.data);
      const nextOrientation = getFlipOrientation(e.data);
      if (nextPage !== null) {
        setPage(nextPage);
        onProgressChangeRef.current?.(nextPage, contentTotal);
      }
      if (nextOrientation) setOrientation(nextOrientation);
    },
    [contentTotal],
  );

  const flipNext = useCallback(() => {
    flipRef.current?.pageFlip?.()?.flipNext("bottom");
  }, []);

  const flipPrev = useCallback(() => {
    flipRef.current?.pageFlip?.()?.flipPrev("bottom");
  }, []);

  const flipTo = useCallback(
    (n: number) => {
      const target = clampPage(n, contentTotal);
      try {
        flipRef.current?.pageFlip?.()?.turnToPage?.(target);
        setPage(target);
        onProgressChangeRef.current?.(target, contentTotal);
      } catch {
        /* noop */
      }
    },
    [contentTotal],
  );

  useEffect(() => {
    setPage(clampedInitialPage);
    setOrientation("landscape");
    if (contentTotal > 0) {
      onProgressChangeRef.current?.(clampedInitialPage, contentTotal);
    }
  }, [clampedInitialPage, contentTotal]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey)
        return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        flipNext();
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        flipPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipNext, flipPrev]);

  useEffect(() => {
    return () => {
      void audioCtxRef.current?.close();
    };
  }, []);

  const flipWidth = Math.floor(size.width * OPEN_BOOK_CONTENT.width);
  const flipHeight = Math.floor(size.height * OPEN_BOOK_CONTENT.height);
  const pageWidth = isPortrait ? flipWidth : flipWidth / 2;

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      {/* Book area */}
      <div className="min-h-0 flex-1 flex items-center justify-center overflow-hidden px-4 py-4 sm:px-8">
        <div
          className="relative select-none"
          style={
            {
              "--lumi-open-book-page-bg": t.pageBg,
              width: size.width,
              height: size.height,
            } as CSSProperties
          }
        >
          <img
            src={OPEN_BOOK_FRAME}
            alt=""
            className="pointer-events-none absolute inset-0 z-30 h-full w-full select-none object-contain opacity-70"
            draggable={false}
            style={{
              filter:
                "sepia(0.35) saturate(0.85) brightness(0.78) contrast(0.96) drop-shadow(0 18px 34px rgba(0,0,0,0.32))",
            }}
          />

          <HTMLFlipBook
            key={`${readerKey}-${size.width}-${size.height}-${contentTotal}`}
            ref={flipRef}
            width={pageWidth + 10}
            height={flipHeight + 10}
            minWidth={pageWidth}
            maxWidth={pageWidth}
            minHeight={flipHeight}
            maxHeight={flipHeight}
            size="fixed"
            startPage={clampedInitialPage}
            drawShadow={true}
            flippingTime={800}
            usePortrait={false}
            startZIndex={10}
            autoSize={false}
            maxShadowOpacity={0.5}
            showCover={false}
            mobileScrollSupport={true}
            clickEventForward={true}
            useMouseEvents={true}
            swipeDistance={35}
            showPageCorners={false}
            disableFlipByClick={false}
            className="lumi-open-book-flipbook"
            style={
              {
                "--lumi-open-book-page-bg": t.pageBg,
                left: size.width * OPEN_BOOK_CONTENT.left,
                top: size.height * OPEN_BOOK_CONTENT.top - 10,
                position: "absolute",
                zIndex: 10,
              } as CSSProperties
            }
            onInit={syncState}
            onUpdate={syncState}
            onChangeOrientation={syncState}
            onFlip={(e: FlipEvent) => {
              syncState(e);
              playPageSound();
            }}
          >
            {flipPages.map((pg, i) => (
              <FlipPage
                key={`${readerKey}-${pg.kind}-${pg.kind === "blank" ? i : pg.n}`}
                pg={pg}
                side={i % 2 === 0 ? "left" : "right"}
                t={t}
                pageNumber={pg.kind !== "blank" ? pg.n : undefined}
              />
            ))}
          </HTMLFlipBook>
        </div>
      </div>

      <ReaderFooter
        t={t}
        page={clampPage(spreadStartIndex, contentTotal)}
        total={contentTotal}
        percent={percent}
        canPrev={page > 0}
        canNext={canNext}
        onPrev={flipPrev}
        onNext={flipNext}
        onSeek={flipTo}
      />
    </div>
  );
}

/* ---------- PDF Reader ---------- */
function PdfReader(props: ReaderBodyProps) {
  const { book, t } = props;
  const cacheKey = getReaderPageCacheKey(book, "pdf");
  const cachedPages = getReaderPageCache<FlipPageData[]>(cacheKey);
  const [pages, setPages] = useState<FlipPageData[]>(() => cachedPages ?? []);
  const [status, setStatus] = useState(() =>
    cachedPages ? "" : "Đang mở PDF...",
  );
  const [error, setError] = useState<ReaderErrorState | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any;

    if (cachedPages) {
      setPages(cachedPages);
      setError(null);
      setStatus("");
      return () => {
        cancelled = true;
      };
    }

    async function init() {
      setPages([]);
      setError(null);
      setStatus("Đang mở PDF...");

      if (!book.fileUrl) {
        setError({
          title: "Không tìm thấy PDF",
          message: "Sách này chưa có file PDF để đọc.",
          canRetry: false,
        });
        return;
      }

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

        const data = new Uint8Array(await readBookArrayBuffer(book));
        loadingTask = pdfjs.getDocument({
          data,
          disableAutoFetch: true,
          disableStream: true,
          useWorkerFetch: false,
        });
        const pdf = await loadingTask.promise;
        const renderedPages: FlipPageData[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return;
          setStatus(`Đang dàn trang PDF ${pageNumber} / ${pdf.numPages}...`);

          const pdfPage = await pdf.getPage(pageNumber);
          const baseViewport = pdfPage.getViewport({ scale: 1 });
          const scale = Math.min(
            2.2,
            PDF_MAX_RENDER_EDGE /
              Math.max(baseViewport.width, baseViewport.height),
          );
          const viewport = pdfPage.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Không tạo được canvas để render PDF.");

          await pdfPage.render({
            canvasContext: ctx,
            viewport,
            background: t.pageBg,
          }).promise;

          renderedPages.push({
            kind: "image",
            src: canvas.toDataURL("image/png"),
            alt: `${book.title} - trang ${pageNumber}`,
            n: pageNumber,
          });
        }

        await pdf.destroy();
        if (!cancelled) {
          setReaderPageCache(cacheKey, renderedPages);
          setPages(renderedPages);
          setStatus("");
        }
      } catch (error) {
        console.error("PDF reader failed", error);
        if (!cancelled) {
          setError(getReaderErrorState(error, "PDF"));
          setStatus("");
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
      void loadingTask?.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, book.fileUrl, retryToken]);

  if (error) {
    return (
      <ReaderStatus
        title={error.title}
        message={error.message}
        t={props.t}
        actionLabel={error.canRetry ? "Thử lại" : undefined}
        onAction={
          error.canRetry
            ? () => {
                setError(null);
                setStatus("Đang thử lại...");
                setRetryToken((value) => value + 1);
              }
            : undefined
        }
      />
    );
  }
  if (status) return <ReaderStatus message={status} t={props.t} />;
  return <ReaderBody {...props} pages={pages} />;
}

/* ---------- EPUB Reader ---------- */
function EpubReader(props: ReaderBodyProps) {
  const { book } = props;
  const cacheKey = getReaderPageCacheKey(book, "epub");
  const cachedPages = getReaderPageCache<FlipPageData[]>(cacheKey);
  const [pages, setPages] = useState<FlipPageData[]>(() => cachedPages ?? []);
  const [status, setStatus] = useState(() =>
    cachedPages ? "" : "Đang mở EPUB...",
  );
  const [error, setError] = useState<ReaderErrorState | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (cachedPages) {
      setPages(cachedPages);
      setError(null);
      setStatus("");
      return () => {
        cancelled = true;
      };
    }

    async function init() {
      setPages([]);
      setError(null);
      setStatus("Đang mở EPUB...");

      if (!book.fileUrl) {
        setError({
          title: "Không tìm thấy EPUB",
          message: "Sách này chưa có file EPUB để đọc.",
          canRetry: false,
        });
        return;
      }

      try {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(await readBookArrayBuffer(book));
        const parser = new DOMParser();
        const containerXml = await zip
          .file("META-INF/container.xml")
          ?.async("text");
        if (!containerXml) throw new Error("EPUB thiếu container.xml.");

        const containerDoc = parser.parseFromString(
          containerXml,
          "application/xml",
        );
        const opfPath = containerDoc
          .querySelector("rootfile")
          ?.getAttribute("full-path");
        if (!opfPath) throw new Error("Không tìm thấy OPF trong EPUB.");

        const opfXml = await zip.file(opfPath)?.async("text");
        if (!opfXml) throw new Error("Không đọc được OPF trong EPUB.");

        const opfDoc = parser.parseFromString(opfXml, "application/xml");
        const manifest = new Map<
          string,
          {
            href: string;
            mediaType: string | null;
          }
        >();

        Array.from(opfDoc.querySelectorAll("item")).forEach((item) => {
          const id = item.getAttribute("id");
          const href = item.getAttribute("href");
          if (!id || !href) return;
          manifest.set(id, {
            href,
            mediaType: item.getAttribute("media-type"),
          });
        });

        let sections = Array.from(opfDoc.querySelectorAll("spine itemref"))
          .map((itemref) => itemref.getAttribute("idref"))
          .filter((idref): idref is string => Boolean(idref))
          .map((idref) => manifest.get(idref))
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        if (sections.length === 0) {
          sections = Array.from(manifest.values()).filter((item) =>
            /html|xhtml|xml/i.test(item.mediaType ?? item.href),
          );
        }

        const blocks: string[] = [];
        for (let i = 0; i < sections.length; i++) {
          if (cancelled) return;
          setStatus(`Đang dàn trang EPUB ${i + 1} / ${sections.length}...`);

          const section = sections[i];
          const sectionPath = resolveEpubAssetPath(opfPath, section.href);
          const sectionFile =
            zip.file(sectionPath) ?? zip.file(decodeURIComponent(sectionPath));
          if (!sectionFile) continue;

          const markup = await sectionFile.async("text");
          blocks.push(...extractTextBlocks(parseEpubDocument(markup)));
        }

        if (!cancelled) {
          const nextPages = paginateTextBlocks(blocks);
          setReaderPageCache(cacheKey, nextPages);
          setPages(nextPages);
          setStatus("");
        }
      } catch (error) {
        console.error("EPUB reader failed", error);
        if (!cancelled) {
          setError(getReaderErrorState(error, "EPUB"));
          setStatus("");
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, book.fileUrl, retryToken]);

  if (error) {
    return (
      <ReaderStatus
        title={error.title}
        message={error.message}
        t={props.t}
        actionLabel={error.canRetry ? "Thử lại" : undefined}
        onAction={
          error.canRetry
            ? () => {
                setError(null);
                setStatus("Đang thử lại...");
                setRetryToken((value) => value + 1);
              }
            : undefined
        }
      />
    );
  }
  if (status) return <ReaderStatus message={status} t={props.t} />;
  return <ReaderBody {...props} pages={pages} />;
}

/* ---------- Reader Status ---------- */
function ReaderStatus({
  actionLabel,
  message,
  onAction,
  t,
  title,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  t: ReaderTheme;
  title?: string;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        className="max-w-md rounded-lg border px-8 py-6 text-center text-sm"
        style={{
          borderColor: t.rule,
          color: t.text,
        }}
      >
        {title && <p className="mb-2 text-base font-semibold">{title}</p>}
        <p style={{ color: t.muted }}>{message}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold transition hover:opacity-90"
            style={{
              backgroundColor: t.accent,
              color: t.accentText,
            }}
          >
            <RefreshCw className="size-3.5" />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

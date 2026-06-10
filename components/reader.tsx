"use client";

import type { Book } from "@/lib/lumi-data";
import {
  readSavedReaderPage,
  saveReaderProgress,
} from "@/lib/reader-progress";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
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
}

export function Reader({ book, onClose }: ReaderProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1410]">
      {/* Header */}
      <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-[#3d2e22] bg-[#241d16] px-5">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-sm font-medium text-[#d4b896]">
            {book.title}
          </h2>
          <p className="truncate text-[11px] text-[#8b7355]">{book.author}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-[#8b7355] transition hover:bg-white/5 hover:text-[#d4b896]"
          aria-label="Đóng trình đọc"
        >
          <X className="size-4" />
        </button>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 bg-[#1a1410]">
        {book.kind === "sample" && <SampleReader book={book} />}
        {book.kind === "pdf" && <PdfReader book={book} />}
        {book.kind === "epub" && <EpubReader book={book} />}
      </div>
    </div>
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
};

type HTMLFlipBookRef = {
  pageFlip: () => PageFlipApi | undefined;
};

type FlipEvent = { data: unknown };

const EPUB_PAGE_CHAR_LIMIT = 360;
const EPUB_PAGE_LINE_LIMIT = 13;
const EPUB_AVERAGE_LINE_CHARS = 40;
const PDF_MAX_RENDER_EDGE = 1300;
const PDF_WORKER_SRC = "/pdf.worker.min.mjs";
const OPEN_BOOK_FRAME = "/open_book.png";
const OPEN_BOOK_RATIO = 1600 / 1054;
const OPEN_BOOK_CONTENT = {
  left: 0.116,
  top: 0.12,
  width: 0.768,
  height: 0.67,
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
        (next.length > limit || estimateRenderedLines(next) > EPUB_PAGE_LINE_LIMIT)
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
  if (book.file) return book.file.arrayBuffer();
  if (!book.fileUrl) throw new Error("Missing book file");

  const response = await fetch(book.fileUrl);
  if (!response.ok) throw new Error("Cannot fetch book file");
  return response.arrayBuffer();
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

/* ---------- FlipPage với nếp gấp mềm mại, không còn chỉ khâu ngang ---------- */
const FlipPage = forwardRef<
  HTMLDivElement,
  {
    pg: FlipPageData;
    side: "left" | "right";
    pageNumber?: number;
  }
>(function FlipPage({ pg, side, pageNumber }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "lumi-open-book-page relative flex h-full w-full flex-col overflow-hidden text-[#2c1810]",
        pg.kind === "image" && "p-0",
        pg.kind === "blank" && "items-center justify-center",
        pg.kind === "text" && "px-8 pb-14 pt-6 sm:px-11 sm:pb-16 sm:pt-8",
      )}
      style={{
        backgroundColor: "#f2e1c0",
        color: "#2c1810",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        boxShadow: `
          inset ${side === "left" ? "-6px" : "6px"} 0 10px -4px rgba(44, 24, 16, 0.25),
          inset ${side === "left" ? "-3px" : "3px"} 0 5px -2px rgba(44, 24, 16, 0.12)
        `,
      }}
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
              rgba(44, 24, 16, 0.18) 0%,
              rgba(44, 24, 16, 0.05) 40%,
              transparent 100%
            )
          `,
        }}
      />

      {/* Số trang */}
      {pageNumber && pg.kind !== "blank" && (
        <div className="absolute bottom-3 left-0 right-0 text-center z-20">
          <span className="text-[10px] font-serif tracking-wider text-[#2c1810]/40">
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
              filter: "sepia(0.15) brightness(0.93)",
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
function SampleReader({ book }: { book: Book }) {
  const pages = useMemo<FlipPageData[]>(() => {
    const result: FlipPageData[] = [];
    for (const ch of book.chapters ?? []) {
      ch.paragraphs.forEach((p) => {
        result.push({
          kind: "text",
          text: p,
          n: result.length + 1,
        });
      });
    }
    return result;
  }, [book]);

  return <BookFlipReader pages={pages} readerKey={book.id} />;
}

/* ---------- Book Flip Reader (gáy sách giữa đã lược bỏ chỉ khâu) ---------- */
function BookFlipReader({
  pages,
  readerKey,
}: {
  pages: FlipPageData[];
  readerKey: string;
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
  const initialPage = useMemo(
    () => readSavedReaderPage(readerKey, contentTotal),
    [contentTotal, readerKey],
  );
  const [page, setPage] = useState(initialPage);
  const [orientation, setOrientation] = useState<FlipOrientation>("landscape");
  const [size, setSize] = useState({ width: 900, height: 717 });

  const isPortrait = orientation === "portrait";
  const spreadSize = isPortrait ? 1 : 2;
  const spreadStartIndex = isPortrait ? page : Math.floor(page / 2) * 2;
  const currentPageStart =
    contentTotal > 0 ? Math.min(spreadStartIndex + 1, contentTotal) : 0;
  const currentPageEnd =
    contentTotal > 0
      ? Math.min(spreadStartIndex + spreadSize, contentTotal)
      : 0;
  const totalSpreads = Math.max(1, Math.ceil(contentTotal / spreadSize));
  const currentSpread =
    contentTotal > 0
      ? Math.min(totalSpreads, Math.floor(spreadStartIndex / spreadSize) + 1)
      : 0;
  const percent =
    contentTotal > 0 ? Math.round((currentSpread / totalSpreads) * 100) : 0;
  const label =
    contentTotal === 0
      ? "Chưa có nội dung"
      : currentPageStart === currentPageEnd
        ? `Trang ${currentPageStart} / ${contentTotal}`
        : `Trang ${currentPageStart}–${currentPageEnd} / ${contentTotal}`;
  const canNext =
    contentTotal > 0 &&
    page <
      Math.max(
        0,
        Math.ceil(contentTotal / spreadSize) * spreadSize - spreadSize,
      );

  // Tính kích thước full container
  useEffect(() => {
    function calcSize() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const availableWidth = Math.max(320, rect.width - 64);
      const availableHeight = Math.max(280, rect.height - 136);
      const width = Math.min(
        availableWidth,
        availableHeight * OPEN_BOOK_RATIO,
        1040,
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

  const syncState = useCallback((e: FlipEvent) => {
    const nextPage = getFlipPageIndex(e.data);
    const nextOrientation = getFlipOrientation(e.data);
    if (nextPage !== null) {
      setPage(nextPage);
      saveReaderProgress(readerKey, nextPage, contentTotal);
    }
    if (nextOrientation) setOrientation(nextOrientation);
  }, [contentTotal, readerKey]);

  const flipNext = useCallback(() => {
    flipRef.current?.pageFlip?.()?.flipNext("bottom");
  }, []);

  const flipPrev = useCallback(() => {
    flipRef.current?.pageFlip?.()?.flipPrev("bottom");
  }, []);

  useEffect(() => {
    const savedPage = readSavedReaderPage(readerKey, contentTotal);
    setPage(savedPage);
    setOrientation("landscape");
    saveReaderProgress(readerKey, savedPage, contentTotal);
  }, [contentTotal, readerKey]);

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
      <div className="min-h-0 flex-1 flex items-center justify-center overflow-hidden px-4 py-7 sm:px-8 bg-[#f2e1c0]">
        <div
          className="relative select-none "
          style={{
            width: size.width,
            height: size.height,
          }}
        >
          <img
            src={OPEN_BOOK_FRAME}
            alt=""
            className="pointer-events-none absolute inset-0 z-30 h-full w-full select-none object-contain"
            draggable={false}
          />

          {/* Book shadow */}
          {/* <div
            className="pointer-events-none absolute inset-x-[4%] bottom-[2%] z-0 h-[12%]"
            style={{
              borderRadius: "50%",
              boxShadow: "0 18px 38px rgba(0,0,0,0.34)",
            }}
          /> */}

          <HTMLFlipBook
            key={`${readerKey}-${size.width}-${size.height}`}
            ref={flipRef}
            width={pageWidth}
            height={flipHeight}
            minWidth={pageWidth}
            maxWidth={pageWidth}
            minHeight={flipHeight}
            maxHeight={flipHeight}
            size="fixed"
            startPage={initialPage}
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
            style={{
              left: size.width * OPEN_BOOK_CONTENT.left,
              top: size.height * OPEN_BOOK_CONTENT.top,
              position: "absolute",
              zIndex: 10,
            }}
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
                pageNumber={pg.kind !== "blank" ? pg.n : undefined}
              />
            ))}
          </HTMLFlipBook>
        </div>
      </div>

      {/* Controls */}
      <div className="h-[61px] shrink-0 border-t border-[#3d2e22] bg-[#241d16] flex items-center justify-center gap-5 px-5">
        <button
          onClick={flipPrev}
          disabled={page <= 0}
          className="flex size-8 items-center justify-center rounded-full border border-[#3d2e22] text-[#8b7355] transition hover:bg-white/5 hover:text-[#d4b896] disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        <div className="flex items-center gap-3 flex-1 max-w-xs">
          <div className="h-1 flex-1 rounded-full bg-[#3d2e22] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${percent}%`,
                background: "linear-gradient(to right, #8b7355, #c4a97d)",
              }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-[#d4b896] font-serif whitespace-nowrap">
            {label}
          </span>
        </div>

        <button
          onClick={flipNext}
          disabled={!canNext}
          className="flex size-8 items-center justify-center rounded-full border border-[#3d2e22] text-[#8b7355] transition hover:bg-white/5 hover:text-[#d4b896] disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="Trang kế"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ---------- PDF Reader ---------- */
function PdfReader({ book }: { book: Book }) {
  const [pages, setPages] = useState<FlipPageData[]>([]);
  const [status, setStatus] = useState("Đang mở PDF...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any;

    async function init() {
      setPages([]);
      setError(null);
      setStatus("Đang mở PDF...");

      if (!book.file && !book.fileUrl) {
        setError("Không tìm thấy file PDF.");
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
            background: "#f2e1c0",
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
          setPages(renderedPages);
          setStatus("");
        }
      } catch (error) {
        console.error("PDF reader failed", error);
        if (!cancelled) {
          setError(`Không đọc được PDF này: ${getErrorMessage(error)}`);
          setStatus("");
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
      void loadingTask?.destroy?.();
    };
  }, [book]);

  if (error) return <ReaderStatus message={error} />;
  if (status) return <ReaderStatus message={status} />;
  return <BookFlipReader pages={pages} readerKey={`pdf-${book.id}`} />;
}

/* ---------- EPUB Reader ---------- */
function EpubReader({ book }: { book: Book }) {
  const [pages, setPages] = useState<FlipPageData[]>([]);
  const [status, setStatus] = useState("Đang mở EPUB...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setPages([]);
      setError(null);
      setStatus("Đang mở EPUB...");

      if (!book.file && !book.fileUrl) {
        setError("Không tìm thấy file EPUB.");
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
          setPages(paginateTextBlocks(blocks));
          setStatus("");
        }
      } catch (error) {
        console.error("EPUB reader failed", error);
        if (!cancelled) {
          setError(`Không đọc được EPUB này: ${getErrorMessage(error)}`);
          setStatus("");
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [book]);

  if (error) return <ReaderStatus message={error} />;
  if (status) return <ReaderStatus message={status} />;
  return <BookFlipReader pages={pages} readerKey={`epub-${book.id}`} />;
}

/* ---------- Reader Status ---------- */
function ReaderStatus({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="px-10 py-6 font-serif text-sm"
        style={{
          backgroundColor: "#f2e1c0",
          color: "#2c1810",
          border: "1px solid rgba(180, 150, 120, 0.3)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
        }}
      >
        {message}
      </div>
    </div>
  );
}

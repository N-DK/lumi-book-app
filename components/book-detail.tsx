"use client";

import type { Book } from "@/lib/lumi-data";
import {
  cardIn,
  fadeIn,
  panelIn,
  pressMotion,
  riseIn,
  staggerContainer,
} from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  BookText,
  Calendar,
  ChevronRight,
  FileText,
  Layers,
  Play,
  Share2,
  Tag,
} from "lucide-react";
import { BookCover } from "@/components/lumi/BookCover";
import { BookmarkToggle } from "@/components/bookmark-toggle";

interface BookDetailProps {
  book: Book;
  similarBooks?: Book[];
  isBookmarked?: boolean;
  isBookmarking?: boolean;
  onClose: () => void;
  onRead: (book: Book) => void;
  onToggleBookmark?: (book: Book) => void;
  onOpenBook?: (book: Book) => void;
}

const COVER_PALETTES = [
  "rust",
  "navy",
  "forest",
  "crimson",
  "charcoal",
  "amber",
] as const;

function getCoverPalette(book: Book): (typeof COVER_PALETTES)[number] {
  let hash = 0;
  for (const ch of book.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COVER_PALETTES[hash % COVER_PALETTES.length];
}

function getYear(published?: string) {
  if (!published) return null;
  const year = new Date(published).getFullYear();
  return Number.isFinite(year) ? year : null;
}

function getFormatLabel(kind: Book["kind"]) {
  if (kind === "pdf") return "PDF";
  if (kind === "epub") return "EPUB";
  return "Bản đọc thử";
}

function getProgressPercent(book: Book) {
  if (!book.progress) return 0;
  return Math.min(100, Math.max(0, Math.round(book.progress.percent)));
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function BookArtwork({ book }: { book: Book }) {
  if (book.coverUrl) {
    return (
      <img
        src={book.coverUrl}
        alt={`Bìa ${book.title}`}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
    );
  }
  return (
    <BookCover
      title={book.title}
      author={book.author}
      palette={getCoverPalette(book)}
      style="stamp"
    />
  );
}

export function BookDetail({
  book,
  similarBooks = [],
  isBookmarked = false,
  isBookmarking = false,
  onClose,
  onRead,
  onToggleBookmark,
  onOpenBook,
}: BookDetailProps) {
  const year = getYear(book.published);
  const themes = book.categories?.length
    ? book.categories
    : book.category
      ? [book.category]
      : [];
  const chapters = book.chapters ?? [];
  const percent = getProgressPercent(book);
  const hasProgress = percent > 0 && percent < 100;
  const totalPages = book.progress?.totalPages ?? 0;

  const meta: { icon: typeof BookOpen; label: string; value: string }[] = [
    { icon: FileText, label: "Định dạng", value: getFormatLabel(book.kind) },
  ];
  if (totalPages > 0) {
    meta.push({
      icon: BookText,
      label: "Số trang",
      value: totalPages.toLocaleString("vi-VN"),
    });
  }
  if (chapters.length > 0) {
    meta.push({
      icon: Layers,
      label: "Số chương",
      value: String(chapters.length),
    });
  }
  if (themes[0]) {
    meta.push({ icon: Tag, label: "Thể loại", value: themes[0] });
  }
  if (year) {
    meta.push({ icon: Calendar, label: "Phát hành", value: String(year) });
  }

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="show"
      exit="exit"
      className="fixed inset-0 z-99 overflow-y-auto bg-ink pb-28 font-body text-paper/90"
    >
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-paper/5 bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6 sm:px-10">
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full transition hover:bg-paper/5"
            aria-label="Quay lại thư viện"
          >
            <ArrowLeft className="size-4" />
          </button>
          <p className="text-xs uppercase tracking-[0.2em] text-paper/40">
            Chi tiết sách
          </p>
          <div className="ml-auto flex items-center gap-1">
            {onToggleBookmark && (
              <BookmarkToggle
                saved={isBookmarked}
                loading={isBookmarking}
                onToggle={() => onToggleBookmark(book)}
              />
            )}
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.share) {
                  void navigator.share({ title: book.title }).catch(() => {});
                } else if (
                  typeof navigator !== "undefined" &&
                  navigator.clipboard
                ) {
                  void navigator.clipboard
                    .writeText(`${book.title} — ${book.author}`)
                    .catch(() => {});
                }
              }}
              className="grid size-9 place-items-center rounded-full transition hover:bg-paper/5"
              aria-label="Chia sẻ"
            >
              <Share2 className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-paper/5">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-oak/30 via-ink to-ink" />
        <div className="pointer-events-none absolute -top-32 -right-32 size-[500px] rounded-full bg-gold/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:px-10 sm:py-20 lg:grid-cols-[260px_1fr] lg:gap-16">
          {/* Cover */}
          <motion.div
            variants={panelIn}
            initial="hidden"
            animate="show"
            className="mx-auto w-52 shrink-0 sm:w-60 lg:mx-0 lg:w-[260px]"
          >
            <motion.div
              whileHover={{ y: -6, rotate: -0.6 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="relative aspect-[2/3] overflow-hidden rounded-xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-paper/10"
              style={{ background: book.spine }}
            >
              <BookArtwork book={book} />
            </motion.div>
            {hasProgress && (
              <div className="mt-5">
                <div className="h-1 overflow-hidden rounded-full bg-paper/10">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-xs tabular-nums text-paper/50">
                  Đã đọc {percent}%
                </p>
              </div>
            )}
          </motion.div>

          {/* Info */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="min-w-0"
          >
            {themes[0] && (
              <motion.p
                variants={riseIn}
                className="mb-3 text-[11px] uppercase tracking-[0.24em] text-gold"
              >
                {themes[0]}
              </motion.p>
            )}
            <motion.h1
              variants={riseIn}
              className="text-balance font-display text-4xl font-bold leading-[1.05] text-paper sm:text-5xl"
            >
              {book.title}
            </motion.h1>

            <motion.div
              variants={riseIn}
              className="mt-6 flex items-center gap-3"
            >
              <div className="grid size-10 place-items-center rounded-full bg-oak text-xs font-semibold text-gold ring-1 ring-paper/10">
                {getInitials(book.author)}
              </div>
              <div>
                <p className="text-sm font-medium text-paper">{book.author}</p>
                <p className="text-xs text-paper/50">
                  Tác giả{year ? ` · ${year}` : ""}
                </p>
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div
              variants={riseIn}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <motion.button
                {...pressMotion}
                whileHover={{ scale: 1.03 }}
                type="button"
                onClick={() => onRead(book)}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-gold px-6 text-sm font-semibold text-ink ring-2 ring-gold/15 transition hover:bg-gold/90"
              >
                <Play className="size-4 fill-current" />
                {hasProgress ? `Tiếp tục — ${percent}%` : "Đọc sách"}
              </motion.button>
              {onToggleBookmark && (
                <motion.button
                  {...pressMotion}
                  whileHover={{ scale: 1.03 }}
                  type="button"
                  onClick={() => onToggleBookmark(book)}
                  disabled={isBookmarking}
                  className={cn(
                    "inline-flex h-12 items-center gap-2 rounded-full border border-paper/10 bg-paper/5 px-5 text-sm font-medium text-paper transition hover:bg-paper/10 disabled:opacity-60",
                    isBookmarked && "border-gold/40 text-gold",
                  )}
                >
                  <Bookmark
                    className={cn("size-4", isBookmarked && "fill-current")}
                  />
                  {isBookmarked ? "Đã lưu" : "Lưu vào kệ"}
                </motion.button>
              )}
            </motion.div>

            {/* Meta strip */}
            <motion.dl
              variants={staggerContainer}
              className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-paper/5 bg-paper/5 sm:grid-cols-4"
            >
              {meta.map((m) => (
                <Meta
                  key={m.label}
                  icon={m.icon}
                  label={m.label}
                  value={m.value}
                />
              ))}
            </motion.dl>
          </motion.div>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto grid max-w-6xl gap-14 px-6 py-16 sm:px-10 lg:grid-cols-[1fr_320px]">
        {/* Left column */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="min-w-0 space-y-14"
        >
          {book.description && (
            <motion.div variants={riseIn}>
              <h2 className="mb-4 font-display text-2xl font-semibold text-paper">
                Về cuốn sách
              </h2>
              <p className="text-pretty leading-[1.85] text-paper/70">
                {book.description}
              </p>

              {themes.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {themes.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-paper/5 bg-paper/5 px-3 py-1.5 text-xs text-paper/70"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Chapters */}
          {chapters.length > 0 && (
            <motion.div variants={riseIn}>
              <div className="mb-5 flex items-end justify-between">
                <h2 className="font-display text-2xl font-semibold text-paper">
                  Mục lục
                </h2>
                <span className="text-xs text-paper/40">
                  {chapters.length} chương
                </span>
              </div>
              <ul className="divide-y divide-paper/5 overflow-hidden rounded-xl border border-paper/5">
                {chapters.map((c, index) => {
                  const current = book.progress?.currentChapter === c.title;
                  return (
                    <li key={`${c.title}-${index}`}>
                      <button
                        type="button"
                        onClick={() => onRead(book)}
                        className={cn(
                          "group flex w-full items-center gap-4 px-5 py-4 text-left transition",
                          current ? "bg-gold/[0.06]" : "hover:bg-paper/[0.03]",
                        )}
                      >
                        <span
                          className={cn(
                            "w-8 font-mono text-xs tabular-nums",
                            current ? "text-gold" : "text-paper/40",
                          )}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-sm font-medium transition-colors",
                              current
                                ? "text-gold"
                                : "text-paper group-hover:text-gold",
                            )}
                          >
                            {c.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-paper/40">
                            {c.paragraphs.length} đoạn
                            {current ? " · đang đọc" : ""}
                          </span>
                        </span>
                        <ChevronRight className="size-4 text-paper/30 transition-colors group-hover:text-gold" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}

          {!book.description && chapters.length === 0 && (
            <motion.p variants={riseIn} className="text-sm text-paper/50">
              Cuốn sách này chưa có mô tả chi tiết. Nhấn “Đọc sách” để bắt đầu.
            </motion.p>
          )}
        </motion.div>

        {/* Right column */}
        <motion.aside
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="space-y-8"
        >
          <motion.div
            variants={riseIn}
            className="rounded-2xl border border-paper/5 bg-shelf/60 p-6"
          >
            <p className="mb-4 text-[10px] uppercase tracking-[0.22em] text-paper/40">
              Tác giả
            </p>
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-full bg-oak text-sm font-semibold text-gold ring-1 ring-paper/10">
                {getInitials(book.author)}
              </div>
              <p className="text-sm font-medium text-paper">{book.author}</p>
            </div>
          </motion.div>

          <motion.div
            variants={riseIn}
            className="space-y-3 rounded-2xl border border-paper/5 bg-shelf/60 p-6"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-paper/40">
              Thông tin
            </p>
            <Row k="Định dạng" v={getFormatLabel(book.kind)} />
            {totalPages > 0 && (
              <Row k="Số trang" v={totalPages.toLocaleString("vi-VN")} />
            )}
            {chapters.length > 0 && (
              <Row k="Số chương" v={String(chapters.length)} />
            )}
            {year && <Row k="Phát hành" v={String(year)} />}
            {themes[0] && <Row k="Thể loại" v={themes.join(" · ")} />}
            <Row k="Tiến độ" v={`${percent}%`} />
          </motion.div>
        </motion.aside>
      </section>

      {/* Similar */}
      {similarBooks.length > 0 && (
        <section className="border-t border-paper/5">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
            <div className="mb-8 flex items-end justify-between">
              <h2 className="font-display text-2xl font-semibold text-paper">
                Sách cùng dòng
              </h2>
            </div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-2 gap-8 sm:grid-cols-4"
            >
              {similarBooks.map((b) => (
                <motion.button
                  key={b.id}
                  {...pressMotion}
                  variants={cardIn}
                  type="button"
                  onClick={() => onOpenBook?.(b)}
                  className="group text-left"
                >
                  <div
                    className="relative mb-3 aspect-[2/3] overflow-hidden rounded-lg shadow-[0_16px_32px_-16px_rgba(0,0,0,0.55)] ring-1 ring-paper/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_24px_48px_-16px_rgba(201,168,118,0.25)]"
                    style={{ background: b.spine }}
                  >
                    <BookArtwork book={b} />
                  </div>
                  <p className="line-clamp-2 text-sm font-medium leading-tight text-paper transition-colors group-hover:text-gold">
                    {b.title}
                  </p>
                  <p className="mt-1 text-xs text-paper/40">{b.author}</p>
                </motion.button>
              ))}
            </motion.div>
          </div>
        </section>
      )}
    </motion.div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
}) {
  return (
    <motion.div variants={cardIn} className="flex flex-col gap-1 bg-ink p-4">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-paper/40">
        <Icon className="size-3" /> {label}
      </span>
      <span className="truncate text-sm font-medium text-paper">{value}</span>
    </motion.div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <span className="shrink-0 text-paper/40">{k}</span>
      <span className="text-right text-paper/80">{v}</span>
    </div>
  );
}

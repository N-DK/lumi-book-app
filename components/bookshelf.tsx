"use client"

import type { Book } from "@/lib/lumi-data"
import { cn } from "@/lib/utils"
import { Bookmark, BookmarkCheck } from "lucide-react"

interface BookshelfProps {
  books: Book[]
  savedBookIds?: Set<string>
  showProgress?: boolean
  emptyLabel?: string
  onOpen: (book: Book) => void
  onToggleBookmark?: (book: Book) => void
}

function getProgressLabel(book: Book) {
  const progress = book.progress
  if (!progress) return "Chưa đọc"
  if (progress.completed || progress.percent >= 100) return "Đã đọc xong"
  if (progress.totalPages > 0) return `Đã đọc ${progress.percent}%`
  return `Trang ${progress.currentPage + 1}`
}

function getProgressPercent(book: Book) {
  return book.progress ? Math.min(100, Math.max(0, book.progress.percent)) : 0
}

export function Bookshelf({
  books,
  savedBookIds,
  showProgress = false,
  emptyLabel = "Chưa có sách.",
  onOpen,
  onToggleBookmark,
}: BookshelfProps) {
  if (books.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-[#332716] bg-[#1d160d]/50 px-6 text-center text-sm text-[#8a744f]">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {books.map((book) => {
        const saved = savedBookIds?.has(book.id) ?? Boolean(book.saved)
        const progressPercent = getProgressPercent(book)

        return (
          <article key={book.id} className="group relative">
            <button
              onClick={() => onOpen(book)}
              className="block w-full text-left"
              aria-label={`Đọc ${book.title}`}
            >
              <div
                className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/[0.06] shadow-[0_14px_34px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-[0_22px_48px_rgba(0,0,0,0.5)]"
                style={{ background: book.spine }}
              >
                {book.coverUrl ? (
                  <>
                    <img
                      src={book.coverUrl}
                      alt={`Bìa ${book.title}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3 pt-8">
                      <p className="line-clamp-2 font-heading text-sm leading-tight text-[#f0e6d2]">
                        {book.title}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[9px] uppercase tracking-[0.2em] text-[#ecdfc5]/60">
                        {book.author}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-between p-4">
                    <div className="flex w-full items-center justify-between">
                      <span className="h-px w-7 bg-[#ecdfc5]/40" />
                      <span className="text-[8px] font-semibold uppercase tracking-[0.3em] text-[#ecdfc5]/60">
                        Lumi
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-3 px-1">
                      <span className="line-clamp-4 text-center font-heading text-base leading-snug text-[#f0e6d2]">
                        {book.title}
                      </span>
                      <span className="h-px w-9 bg-[#ecdfc5]/35" />
                    </div>
                    <span className="line-clamp-1 text-[9px] uppercase tracking-[0.22em] text-[#ecdfc5]/55">
                      {book.author}
                    </span>
                  </div>
                )}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/25 via-transparent to-white/[0.07]" />
              </div>
            </button>

            {onToggleBookmark && (
              <button
                onClick={() => onToggleBookmark(book)}
                className={cn(
                  "absolute right-2 top-2 z-20 flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/45 text-[#ecdfc5] shadow-lg backdrop-blur transition hover:bg-black/65",
                  saved && "text-[#d9b98a]",
                )}
                aria-label={saved ? "Bỏ lưu sách" : "Lưu sách"}
                aria-pressed={saved}
              >
                {saved ? (
                  <BookmarkCheck className="size-4" />
                ) : (
                  <Bookmark className="size-4" />
                )}
              </button>
            )}

            {showProgress && (
              <div className="mt-2 space-y-1">
                <div className="h-1 overflow-hidden rounded-full bg-[#332716]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#a8895c] to-[#d9b98a] transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="truncate text-[10px] text-[#8a744f]">
                  {getProgressLabel(book)}
                </p>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

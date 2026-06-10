"use client"

import type { Book } from "@/lib/lumi-data"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"

interface BookshelfProps {
  books: Book[]
  onOpen: (book: Book) => void
  onImport: (files: FileList | null) => void
}

const KIND_LABEL: Record<Book["kind"], string> = {
  sample: "Sách mẫu",
  pdf: "PDF",
  epub: "EPUB",
}

export function Bookshelf({ books, onOpen, onImport }: BookshelfProps) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {books.map((book) => (
        <button
          key={book.id}
          onClick={() => onOpen(book)}
          className="group relative flex flex-col items-center"
        >
          <div
            className="relative aspect-[2/3] w-full overflow-hidden rounded-r-md rounded-l-sm shadow-lg transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-2xl"
            style={{ background: book.spine }}
          >
            {book.coverUrl && (
              <img
                src={book.coverUrl}
                alt={`Bìa ${book.title}`}
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            )}
            {/* gáy sách */}
            <span className="absolute inset-y-0 left-0 w-2 bg-black/25" />
            <span className="absolute inset-y-0 left-2 w-px bg-white/15" />
            {/* nội dung bìa */}
            <div
              className={cn(
                "relative z-10 flex h-full flex-col justify-between p-3 pl-5 text-left",
                book.coverUrl && "bg-gradient-to-b from-black/40 via-transparent to-black/55",
              )}
            >
              <span
                className="font-heading text-sm leading-tight"
                style={{ color: "oklch(0.88 0.08 85)" }}
              >
                {book.title}
              </span>
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "oklch(0.85 0.06 85 / 0.8)" }}
              >
                {book.author}
              </span>
            </div>
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/10" />
          </div>

          {/* tooltip */}
          <span className="pointer-events-none absolute -top-2 left-1/2 z-10 w-max max-w-[160px] -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-3 py-1.5 text-center text-xs text-popover-foreground opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100">
            <span className="block font-heading">{book.title}</span>
            <span className="block text-[10px] text-muted-foreground">
              {book.author} · {KIND_LABEL[book.kind]}
            </span>
          </span>
        </button>
      ))}

      {/* thêm sách */}
      <label
        className={cn(
          "group flex aspect-[2/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary",
        )}
      >
        <Plus className="size-7 transition group-hover:scale-110" />
        <span className="text-xs">Thêm sách</span>
        <span className="px-2 text-center text-[10px] text-muted-foreground/70">
          PDF hoặc EPUB
        </span>
        <input
          type="file"
          accept="application/pdf,application/epub+zip,.epub,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            onImport(e.target.files)
            e.currentTarget.value = ""
          }}
        />
      </label>
    </div>
  )
}

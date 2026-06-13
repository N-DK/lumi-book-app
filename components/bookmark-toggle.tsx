"use client"

import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface BookmarkToggleProps {
  saved: boolean
  loading: boolean
  onToggle: () => void
  className?: string
}

export function BookmarkToggle({
  saved,
  loading,
  onToggle,
  className,
}: BookmarkToggleProps) {
  return (
    <label
      className={cn(
        "ui-bookmark flex size-9 items-center justify-center rounded-full border border-[#d9b98a]/35 bg-[#1d160d]/80 shadow-[0_10px_26px_rgba(0,0,0,0.55)] backdrop-blur-md transition hover:border-[#d9b98a]/60 hover:bg-[#241b10]/90",
        saved &&
          "is-saved border-[#d9b98a]/75 bg-[#2b2115]/95 shadow-[0_10px_30px_rgba(217,185,138,0.26)]",
        loading && "is-loading cursor-wait",
        className,
      )}
      aria-label={saved ? "Bỏ lưu sách" : "Lưu sách"}
      aria-busy={loading}
    >
      <input
        type="checkbox"
        checked={saved}
        disabled={loading}
        onChange={onToggle}
      />
      <span className="bookmark" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <g>
            <path d="M27 4v27a1 1 0 0 1-1.625.781L16 24.281l-9.375 7.5A1 1 0 0 1 5 31V4a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4z" />
          </g>
        </svg>
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[#1d160d]/70 text-[#d9b98a]">
          <Loader2 className="size-4 animate-spin" />
        </span>
      )}
    </label>
  )
}

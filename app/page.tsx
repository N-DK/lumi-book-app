"use client";

import { Bookshelf } from "@/components/bookshelf";
import { MusicPlayer } from "@/components/music-player";
import { RainOverlay } from "@/components/rain-overlay";
import { Reader, type ReaderProgressUpdate } from "@/components/reader";
import { SpacePanel } from "@/components/space-panel";
import {
  ApiError,
  type ApiPlaylist,
  type AuthUser,
  getCurrentUser,
  listBooks,
  listBookmarks,
  listCategories,
  listPlaylists,
  logoutUser,
  removeBookmark,
  removeTrackFromPlaylist,
  saveBookmark,
  saveReadingProgress,
  addTrackToPlaylist,
  toReaderBook,
  type TrackPayload,
} from "@/lib/api-client";
import { PRESET_SCENES, type Book } from "@/lib/lumi-data";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Heart,
  History,
  Library,
  LogIn,
  Loader2,
  LogOut,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AppTab = "discover" | "for-you" | "me" | "favorites" | "recent";
const APP_TABS: AppTab[] = ["discover", "for-you", "me", "favorites", "recent"];

const DEFAULT_BACKGROUND =
  PRESET_SCENES.find((scene) => scene.id === "wood")?.css ??
  PRESET_SCENES[0].css;
const SIDEBAR_WIDTH = 256;
const HEADER_HEIGHT = 72;
const RIGHT_DOCK_GUTTER = 112;
const PLAYER_HEIGHT = 92;
const RECOMMENDED_PAGE_SIZE = 15;
const LOGO_SRC = "/logo.png";

function BrandLogo({
  className,
  alt = "LUMI",
}: {
  className: string;
  alt?: string;
}) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      className={cn("block object-contain", className)}
      draggable={false}
    />
  );
}

function getTabFromPathname(pathname: string | null): AppTab {
  const segment = pathname?.split("/").filter(Boolean)[0] ?? "discover";
  return APP_TABS.includes(segment as AppTab)
    ? (segment as AppTab)
    : "discover";
}

function getTabHref(tab: AppTab) {
  return `/${tab}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Có lỗi xảy ra.";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function getHighlightedRange(value: string, query: string) {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return null;

  let normalized = "";
  const indexMap: number[] = [];

  for (let index = 0; index < value.length; ) {
    const char = Array.from(value.slice(index))[0];
    const clean = normalizeSearchText(char);

    for (let i = 0; i < clean.length; i += 1) {
      normalized += clean[i];
      indexMap.push(index);
    }

    index += char.length;
  }

  const start = normalized.indexOf(normalizedQuery);
  if (start < 0) return null;

  const lastMatchIndex = start + normalizedQuery.length - 1;
  const originalStart = indexMap[start];
  const originalEnd =
    lastMatchIndex + 1 < indexMap.length
      ? indexMap[lastMatchIndex + 1]
      : value.length;

  return { start: originalStart, end: originalEnd };
}

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  const range = getHighlightedRange(title, query);
  if (!range) return <>{title}</>;

  return (
    <>
      {title.slice(0, range.start)}
      <span className="font-semibold text-[#d9b98a]">
        {title.slice(range.start, range.end)}
      </span>
      {title.slice(range.end)}
    </>
  );
}

function SearchBookCover({ book }: { book: Book }) {
  return (
    <span
      className="relative h-11 w-8 shrink-0 overflow-hidden rounded-[5px] border border-[#3a2d1a] shadow-[0_8px_18px_rgba(0,0,0,0.34)]"
      style={{ background: book.spine }}
      aria-hidden="true"
    >
      {book.coverUrl ? (
        <img
          src={book.coverUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <>
          <span className="absolute inset-y-0 left-0 w-1 bg-black/25" />
          <span className="absolute inset-0 bg-gradient-to-br from-white/[0.16] via-transparent to-black/25" />
        </>
      )}
    </span>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#141009]">
      <div className="flex items-center gap-3 rounded-2xl border border-[#332716] bg-[#1d160d]/90 px-5 py-4 text-[#d9b98a] shadow-2xl">
        <span className="flex size-10 items-center justify-center rounded-xl border border-[#3a2d1a] bg-[#241b10] p-1.5">
          <Loader2 className="size-5 animate-spin" />
        </span>
        <div>
          <BrandLogo className="h-16 w-auto max-w-[112px]" />
          <p className="mt-1 text-xs text-[#8a744f]">Đang mở thư viện...</p>
        </div>
      </div>
    </main>
  );
}

function TopicSkeleton() {
  return (
    <section className="space-y-5" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 animate-pulse rounded-md bg-[#2b2115]" />
        <div className="flex gap-2">
          <div className="size-9 animate-pulse rounded-full bg-[#241b10]" />
          <div className="size-9 animate-pulse rounded-full bg-[#241b10]" />
        </div>
      </div>
      <div className="grid grid-flow-col grid-rows-2 auto-cols-[minmax(190px,1fr)] gap-4 overflow-hidden p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl bg-[#241b10]"
          />
        ))}
      </div>
    </section>
  );
}

function ShelfSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="aspect-[2/3] rounded-lg bg-[#241b10] shadow-lg" />
          <div className="mt-3 h-3 w-4/5 rounded-full bg-[#2b2115]" />
          <div className="mt-2 h-2.5 w-1/2 rounded-full bg-[#241b10]" />
        </div>
      ))}
    </div>
  );
}

function SidebarItem({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: typeof Compass;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-xl px-4 text-left text-[14px] font-medium transition",
        active
          ? "bg-[#2b2115] text-[#ecdfc5] shadow-[inset_0_1px_0_rgba(236,223,197,0.06)]"
          : "text-[#a3937a] hover:bg-[#241b10] hover:text-[#ecdfc5]",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a744f]">
      {children}
    </p>
  );
}

function AppSidebar({
  activeTab,
  setActiveTab,
  user,
}: {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  user: AuthUser | null;
}) {
  return (
    <aside
      className="fixed left-0 top-0 z-[80] flex h-screen flex-col overflow-y-auto border-r border-[#2b2115] bg-[#16110a] px-3 py-5 lumi-scroll"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <div className="mb-7 flex items-center gap-3 px-3">
        {/* <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl border border-[#3a2d1a] bg-[#241b10] p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
          <BrandLogo className="h-full w-full" />
        </span> */}
        <div className="min-w-0">
          <BrandLogo className="h-16 w-auto" />
          <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a744f]">
            Không gian đọc
          </p>
        </div>
      </div>

      <div className="mb-7">
        <SidebarSectionLabel>Thư viện</SidebarSectionLabel>
        <nav className="space-y-1">
          <SidebarItem
            active={activeTab === "discover"}
            icon={Compass}
            label="Khám phá"
            onClick={() => setActiveTab("discover")}
          />
          <SidebarItem
            active={activeTab === "for-you"}
            icon={Sparkles}
            label="Dành cho bạn"
            onClick={() => setActiveTab("for-you")}
          />
          <SidebarItem
            active={activeTab === "me"}
            icon={Library}
            label="Kệ sách của tôi"
            onClick={() => setActiveTab("me")}
          />
        </nav>
      </div>

      <div className="mb-4">
        <SidebarSectionLabel>Cá nhân</SidebarSectionLabel>
        <nav className="space-y-1">
          <SidebarItem
            active={activeTab === "favorites"}
            icon={Heart}
            label="Nhạc yêu thích"
            onClick={() => setActiveTab("favorites")}
          />
          <SidebarItem
            active={activeTab === "recent"}
            icon={History}
            label="Đọc gần đây"
            onClick={() => setActiveTab("recent")}
          />
        </nav>
      </div>

      <div className="mt-auto px-3 pt-6">
        {user ? (
          <p className="mb-2 text-xs leading-tight text-[#8a744f]">
            Xin chào, {user.name}
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs leading-tight text-[#8a744f]">
              Đăng nhập để giữ kệ sách và playlist của bạn
            </p>
            <a
              href="/login"
              className="flex h-10 items-center justify-center rounded-xl border border-[#3a2d1a] bg-[#241b10] text-sm font-semibold text-[#d9b98a] transition hover:bg-[#2b2115]"
            >
              Đăng nhập
            </a>
          </>
        )}
      </div>
    </aside>
  );
}

function TopHeader({
  activeTab,
  setActiveTab,
  search,
  setSearch,
  searchResults,
  searchLoading,
  user,
  onLogout,
  onOpenBook,
  onClearSearch,
}: {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  search: string;
  setSearch: (value: string) => void;
  searchResults: Book[];
  searchLoading: boolean;
  user: AuthUser | null;
  onLogout: () => void;
  onOpenBook: (book: Book) => void;
  onClearSearch: () => void;
}) {
  const [searchFocused, setSearchFocused] = useState(false);
  const trimmedSearch = search.trim();
  const showSearchPanel = searchFocused && trimmedSearch.length > 0;
  const activeTabIndex = APP_TABS.indexOf(activeTab);
  const prevTab = activeTabIndex > 0 ? APP_TABS[activeTabIndex - 1] : null;
  const nextTab =
    activeTabIndex >= 0 && activeTabIndex < APP_TABS.length - 1
      ? APP_TABS[activeTabIndex + 1]
      : null;

  return (
    <header
      className="fixed right-0 top-0 z-[70] border-b border-[#2b2115] bg-[#16110a]/[0.92] backdrop-blur"
      style={{ left: SIDEBAR_WIDTH, height: HEADER_HEIGHT }}
    >
      <div className="flex h-full min-w-0 items-center gap-4 px-8">
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <button
            type="button"
            onClick={() => prevTab && setActiveTab(prevTab)}
            disabled={!prevTab}
            className={cn(
              "flex size-10 items-center justify-center rounded-full border border-[#3a2d1a] bg-[#241b10] shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition hover:border-[#d9b98a]/45 hover:bg-[#2b2115] hover:text-[#d9b98a] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[#3a2d1a] disabled:hover:bg-[#241b10]",
              prevTab ? "text-[#a3937a]" : "text-[#8a744f]",
            )}
            aria-label="Quay lại"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => nextTab && setActiveTab(nextTab)}
            disabled={!nextTab}
            className={cn(
              "flex size-10 items-center justify-center rounded-full border border-[#3a2d1a] bg-[#241b10] shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition hover:border-[#d9b98a]/45 hover:bg-[#2b2115] hover:text-[#d9b98a] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[#3a2d1a] disabled:hover:bg-[#241b10]",
              nextTab ? "text-[#ecdfc5]" : "text-[#8a744f]",
            )}
            aria-label="Đi tiếp"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <label className="relative min-w-[260px] max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#d9b98a]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearchFocused(false);
                onClearSearch();
              }
            }}
            className="h-11 w-full rounded-xl border border-[#3a2d1a] bg-[#1d160d] pl-11 pr-11 text-sm font-medium text-[#f0e6d2] outline-none transition placeholder:text-[#8a744f] focus:border-[#d9b98a]/60 focus:bg-[#241b10]"
            placeholder="Tìm sách, tác giả..."
          />
          {trimmedSearch && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClearSearch}
              className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-[#3a2d1a] text-[#d9b98a] transition hover:bg-[#4a3a21]"
              aria-label="Xóa tìm kiếm"
            >
              <X className="size-3.5" />
            </button>
          )}

          {showSearchPanel && (
            <div
              className="absolute left-0 right-0 top-full z-[100] mt-2 overflow-hidden rounded-xl border border-[#332716] bg-[#1d160d] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.52)]"
              onMouseDown={(event) => event.preventDefault()}
            >
              {searchLoading && searchResults.length === 0 ? (
                <div className="space-y-1">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex h-[60px] items-center gap-3 rounded-lg px-3"
                    >
                      <div className="h-11 w-8 animate-pulse rounded-[5px] bg-[#2b2115]" />
                      <div className="space-y-2">
                        <div className="h-3 w-48 animate-pulse rounded-full bg-[#332716]" />
                        <div className="h-2.5 w-28 animate-pulse rounded-full bg-[#2b2115]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.slice(0, 6).map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => {
                        onOpenBook(book);
                        setSearchFocused(false);
                      }}
                      className="flex h-[60px] w-full items-center gap-3 rounded-lg px-3 text-left transition hover:bg-[#2b2115] focus-visible:bg-[#2b2115] focus-visible:outline-none"
                    >
                      <SearchBookCover book={book} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#f0e6d2]">
                          <HighlightedTitle
                            title={book.title}
                            query={trimmedSearch}
                          />
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[#8a744f]">
                          {book.author}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-12 items-center gap-3 rounded-lg px-3 text-sm text-[#8a744f]">
                  <Search className="size-5 shrink-0 text-[#8a744f]" />
                  Không tìm thấy sách phù hợp.
                </div>
              )}
            </div>
          )}
        </label>

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-4">
          {user ? (
            <>
              <button
                onClick={onLogout}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-[#a3937a] transition hover:text-[#ecdfc5]"
              >
                <LogOut className="size-4" />
                Đăng xuất
              </button>
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#d9b98a] text-sm font-bold text-[#241b10] ring-1 ring-[#3a2d1a]">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  getInitials(user.name)
                )}
              </span>
            </>
          ) : (
            <a
              href="/login"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#d9b98a] px-5 text-sm font-bold text-[#241b10] transition hover:brightness-110"
            >
              <LogIn className="size-4" />
              Đăng nhập
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

function BookCoverMini({ book }: { book: Book }) {
  return (
    <div
      className="relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] shadow-[0_18px_42px_rgba(0,0,0,0.45)]"
      style={{ background: book.spine }}
    >
      {book.coverUrl ? (
        <img
          src={book.coverUrl}
          alt={`Bìa ${book.title}`}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-between p-4">
          <div className="flex w-full items-center justify-between">
            <span className="h-px w-7 bg-[#ecdfc5]/40" />
            <span className="text-[8px] font-semibold uppercase tracking-[0.3em] text-[#ecdfc5]/60">
              Lumi
            </span>
          </div>
          <span className="line-clamp-4 text-center font-heading text-sm leading-snug text-[#f0e6d2]">
            {book.title}
          </span>
          <span className="line-clamp-1 text-[9px] uppercase tracking-[0.22em] text-[#ecdfc5]/55">
            {book.author}
          </span>
        </div>
      )}
    </div>
  );
}

function ContinueReadingHero({
  book,
  onContinue,
}: {
  book: Book;
  onContinue: () => void;
}) {
  const progress = book.progress;
  const percent = progress ? Math.min(100, Math.max(0, progress.percent)) : 0;
  const pageLabel = progress ? progress.currentPage + 1 : 1;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#332716] bg-gradient-to-br from-[#261c10] via-[#1f160c] to-[#19120a] p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-[#d9b98a]/[0.05]" />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <BookCoverMini book={book} />
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-full border border-[#d9b98a]/30 bg-[#d9b98a]/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d9b98a]">
            Đang đọc tiếp
          </span>
          <h2 className="mt-4 font-heading text-3xl leading-tight text-[#f0e6d2] sm:text-4xl">
            {book.title}
          </h2>
          {book.description && (
            <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-[#b3a285]">
              {book.description}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              onClick={onContinue}
              className="inline-flex h-11 items-center rounded-xl border border-[#d9b98a]/40 bg-[#d9b98a]/[0.1] px-5 text-sm font-semibold text-[#e8cf9f] transition hover:bg-[#d9b98a]/[0.18]"
            >
              Tiếp tục — Trang {pageLabel}
            </button>
            <div className="flex min-w-[180px] flex-1 items-center gap-3">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#332716]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#a8895c] to-[#d9b98a] transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-[#b3a285]">
                {percent}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsCards({
  readingCount,
  completedCount,
  onOpenLibrary,
}: {
  readingCount: number;
  completedCount: number;
  onOpenLibrary: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-[#332716] bg-[#1d160d] p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a744f]">
          Đang đọc
        </p>
        <p className="mt-3 font-heading text-4xl text-[#f0e6d2]">
          {readingCount} sách
        </p>
        <p className="mt-2 text-xs text-[#b3a285]">
          {completedCount} cuốn đã đọc xong
        </p>
      </section>

      <section className="flex flex-1 items-center justify-between gap-4 rounded-2xl border border-[#332716] bg-[#1d160d] p-6">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a744f]">
            Bộ sưu tập
          </p>
          <p className="mt-2 truncate font-heading text-xl text-[#f0e6d2]">
            Kệ sách của tôi
          </p>
        </div>
        <button
          onClick={onOpenLibrary}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#3a2d1a] bg-[#241b10] text-[#d9b98a] transition hover:bg-[#2b2115]"
          aria-label="Mở kệ sách của tôi"
        >
          <ArrowRight className="size-5" />
        </button>
      </section>
    </div>
  );
}

const TOPIC_GRADIENTS = [
  "linear-gradient(120deg, #4b3621 0%, #8a6a45 100%)",
  "linear-gradient(120deg, #3f4ad9 0%, #7b8cff 100%)",
  "linear-gradient(120deg, #c9a876 0%, #efe0c3 100%)",
  "linear-gradient(120deg, #d97b4f 0%, #f0a987 100%)",
  "linear-gradient(120deg, #2e3a8c 0%, #5a4fcf 100%)",
  "linear-gradient(120deg, #7a2fa3 0%, #c84fd9 100%)",
  "linear-gradient(120deg, #2f7fb8 0%, #7cc3ef 100%)",
  "linear-gradient(120deg, #4f7a55 0%, #8db98a 100%)",
  "linear-gradient(120deg, #6b3226 0%, #a85a3c 100%)",
  "linear-gradient(120deg, #b84a7c 0%, #e88aae 100%)",
  "linear-gradient(120deg, #8a6a1f 0%, #cfa845 100%)",
  "linear-gradient(120deg, #1f1f1f 0%, #4a4a4a 100%)",
];

function CategoryTopics({
  categories,
  category,
  setCategory,
}: {
  categories: string[];
  category: string;
  setCategory: (value: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const items = [
    { value: "all", label: "Tất cả" },
    ...categories.map((item) => ({ value: item, label: item })),
  ];

  const updateScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateScroll();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScroll, categories.length]);

  function scrollTopics(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-[26px] leading-none text-[#f0e6d2]">
          Chủ đề
        </h2>
        {(canScroll.left || canScroll.right) && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollTopics(-1)}
              disabled={!canScroll.left}
              className="flex size-9 items-center justify-center rounded-full border border-[#3a2d1a] bg-[#241b10] text-[#d9b98a] transition hover:bg-[#2b2115] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Cuộn chủ đề sang trái"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => scrollTopics(1)}
              disabled={!canScroll.right}
              className="flex size-9 items-center justify-center rounded-full border border-[#3a2d1a] bg-[#241b10] text-[#d9b98a] transition hover:bg-[#2b2115] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Cuộn chủ đề sang phải"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        onScroll={updateScroll}
        className="grid grid-flow-col grid-rows-2 auto-cols-[minmax(190px,1fr)] gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-4"
      >
        {items.map((item, index) => {
          const active = category === item.value;
          return (
            <button
              key={item.value}
              onClick={() => setCategory(item.value)}
              className={cn(
                "group relative h-24 overflow-hidden rounded-xl p-3 text-left shadow-[0_10px_26px_rgba(0,0,0,0.3)] transition-transform duration-300 hover:-translate-y-1",
                active &&
                  "ring-2 ring-[#d9b98a] ring-offset-2 ring-offset-[#141009]",
              )}
              style={{
                background: TOPIC_GRADIENTS[index % TOPIC_GRADIENTS.length],
              }}
              aria-pressed={active}
            >
              <span className="relative z-10 text-sm font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
                {item.label}
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-5 -right-2 font-heading text-7xl font-bold text-white/[0.14] transition-transform duration-300 group-hover:scale-110"
              >
                {item.label.charAt(0).toUpperCase()}
              </span>
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function Page() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTabState] = useState<AppTab>(() =>
    getTabFromPathname(pathname),
  );
  const setActiveTab = useCallback((tab: AppTab) => {
    const href = getTabHref(tab);
    setActiveTabState(tab);

    if (typeof window !== "undefined" && window.location.pathname !== href) {
      window.history.pushState({ tab }, "", href);
    }
  }, []);
  const [books, setBooks] = useState<Book[]>([]);
  const [libraryBooks, setLibraryBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [bookmarkingBookIds, setBookmarkingBookIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [category, setCategory] = useState("all");
  const [openBook, setOpenBook] = useState<Book | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingMoreBooks, setLoadingMoreBooks] = useState(false);
  const [recommendedPage, setRecommendedPage] = useState(1);
  const [hasMoreRecommendedBooks, setHasMoreRecommendedBooks] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [background, setBackground] = useState(DEFAULT_BACKGROUND);
  const [dark, setDark] = useState(true);
  const [rain, setRain] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const savedBookIds = useMemo(
    () => new Set(libraryBooks.map((book) => book.id)),
    [libraryBooks],
  );
  const defaultPlaylist =
    playlists.find((playlist) => playlist.isDefault) ?? playlists[0];

  const continueBook = useMemo(
    () =>
      libraryBooks.find(
        (book) =>
          book.progress &&
          !book.progress.completed &&
          book.progress.currentPage > 0,
      ) ??
      libraryBooks.find((book) => book.progress) ??
      null,
    [libraryBooks],
  );
  const readingCount = useMemo(
    () =>
      libraryBooks.filter((book) => book.progress && !book.progress.completed)
        .length,
    [libraryBooks],
  );
  const completedCount = useMemo(
    () =>
      libraryBooks.filter(
        (book) =>
          book.progress &&
          (book.progress.completed || book.progress.percent >= 100),
      ).length,
    [libraryBooks],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    if (pathname !== "/") {
      setActiveTabState(getTabFromPathname(pathname));
      return;
    }

    const href = getTabHref("discover");
    setActiveTabState("discover");
    window.history.replaceState({ tab: "discover" }, "", href);
  }, [pathname]);

  useEffect(() => {
    function handlePopState() {
      setActiveTabState(getTabFromPathname(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const refreshLibrary = useCallback(async () => {
    const [bookmarkData, playlistData] = await Promise.all([
      listBookmarks(),
      listPlaylists(),
    ]);
    setLibraryBooks(bookmarkData.books.map(toReaderBook));
    setPlaylists(playlistData.playlists);
  }, []);

  const refreshDiscover = useCallback(
    async (page = 1, mode: "replace" | "append" = "replace") => {
      const bookData = await listBooks({
        category,
        page,
        limit: RECOMMENDED_PAGE_SIZE,
      });
      const mappedBooks = bookData.books.map(toReaderBook);

      setBooks((currentBooks) => {
        if (mode === "replace") return mappedBooks;

        const existingIds = new Set(currentBooks.map((book) => book.id));
        const nextBooks = mappedBooks.filter(
          (book) => !existingIds.has(book.id),
        );
        return [...currentBooks, ...nextBooks];
      });
      setRecommendedPage(bookData.page ?? page);
      setHasMoreRecommendedBooks(Boolean(bookData.hasMore));
    },
    [category],
  );

  const refreshAll = useCallback(async () => {
    setLoadingData(true);
    setError(null);

    try {
      const [categoryData] = await Promise.all([
        listCategories(),
        refreshDiscover(),
        refreshLibrary(),
      ]);
      setCategories(categoryData.categories);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoadingData(false);
    }
  }, [refreshDiscover, refreshLibrary]);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const data = await getCurrentUser();
        if (!cancelled) setUser(data.user);
      } catch (error) {
        if (!cancelled) setError(getErrorMessage(error));
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    void loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // Chưa đăng nhập thì chuyển sang /login
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    void refreshAll();
  }, [refreshAll, user]);

  const loadMoreRecommendedBooks = useCallback(async () => {
    if (
      !user ||
      activeTab !== "discover" ||
      loadingData ||
      loadingMoreBooks ||
      !hasMoreRecommendedBooks
    ) {
      return;
    }

    setLoadingMoreBooks(true);
    try {
      await refreshDiscover(recommendedPage + 1, "append");
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoadingMoreBooks(false);
    }
  }, [
    activeTab,
    hasMoreRecommendedBooks,
    loadingData,
    loadingMoreBooks,
    recommendedPage,
    refreshDiscover,
    user,
  ]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || activeTab !== "discover" || !hasMoreRecommendedBooks) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreRecommendedBooks();
        }
      },
      { rootMargin: "420px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, hasMoreRecommendedBooks, loadMoreRecommendedBooks]);

  useEffect(() => {
    const query = search.trim();
    if (!user || !query) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const bookData = await listBooks({ search: query, limit: 8 });
        if (!cancelled) setSearchResults(bookData.books.map(toReaderBook));
      } catch (error) {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [search, user]);

  async function handleLogout() {
    try {
      await logoutUser();
      setUser(null);
      setBooks([]);
      setLibraryBooks([]);
      setPlaylists([]);
      setSearch("");
      setSearchResults([]);
      setBookmarkingBookIds(new Set());
      setOpenBook(null);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }

  async function handleToggleBookmark(book: Book) {
    setError(null);
    if (bookmarkingBookIds.has(book.id)) return;

    const nextSaved = !savedBookIds.has(book.id);
    setBookmarkingBookIds((items) => {
      const next = new Set(items);
      next.add(book.id);
      return next;
    });

    try {
      if (savedBookIds.has(book.id)) {
        await removeBookmark(book.id);
      } else {
        await saveBookmark(book.id);
      }
      setBooks((items) =>
        items.map((item) =>
          item.id === book.id ? { ...item, saved: nextSaved } : item,
        ),
      );
      setSearchResults((items) =>
        items.map((item) =>
          item.id === book.id ? { ...item, saved: nextSaved } : item,
        ),
      );
      await refreshLibrary();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBookmarkingBookIds((items) => {
        const next = new Set(items);
        next.delete(book.id);
        return next;
      });
    }
  }

  async function handleProgressChange(
    book: Book,
    progress: ReaderProgressUpdate,
  ) {
    try {
      const data = await saveReadingProgress(book.id, progress);
      const applyProgress = (item: Book) =>
        item.id === book.id ? { ...item, progress: data.progress } : item;

      setBooks((items) => items.map(applyProgress));
      setLibraryBooks((items) => items.map(applyProgress));
      setOpenBook((current) =>
        current?.id === book.id ? applyProgress(current) : current,
      );
    } catch (error) {
      console.warn("Không lưu được tiến độ đọc.", error);
    }
  }

  async function handleAddTrack(payload: TrackPayload) {
    if (!defaultPlaylist) return;
    setError(null);

    try {
      const data = await addTrackToPlaylist(defaultPlaylist.id, payload);
      setPlaylists((items) =>
        items.map((playlist) =>
          playlist.id === data.playlist.id ? data.playlist : playlist,
        ),
      );
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }

  async function handleRemoveTrack(trackId: string) {
    if (!defaultPlaylist) return;
    setError(null);

    try {
      const data = await removeTrackFromPlaylist(defaultPlaylist.id, trackId);
      setPlaylists((items) =>
        items.map((playlist) =>
          playlist.id === data.playlist.id ? data.playlist : playlist,
        ),
      );
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }

  if (authLoading) return <LoadingScreen />;
  if (!user) return <LoadingScreen />;

  const libraryTitle =
    activeTab === "favorites"
      ? "Nhạc yêu thích"
      : activeTab === "recent"
        ? "Đọc gần đây"
        : activeTab === "for-you"
          ? "Dành cho bạn"
          : "Kệ sách của tôi";
  const libraryDescription =
    activeTab === "favorites"
      ? "Các bài hát bạn đã thêm vào không gian nghe của mình."
      : activeTab === "recent"
        ? "Sách đang đọc dở và tiến độ đọc gần nhất."
        : "Những cuốn sách bạn đã lưu cùng tiến độ đọc của bạn.";

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden bg-[#141009]"
      style={{ background }}
    >
      <div className="fixed inset-0 bg-[#120d07]/[0.84]" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_75%_0%,rgba(217,185,138,0.06),transparent_30%)]" />
      <RainOverlay enabled={rain} />

      <AppSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
      />
      <TopHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        search={search}
        setSearch={setSearch}
        searchResults={searchResults}
        searchLoading={searchLoading}
        user={user}
        onLogout={handleLogout}
        onOpenBook={setOpenBook}
        onClearSearch={() => {
          setSearch("");
          setSearchResults([]);
        }}
      />

      <main
        className="relative min-h-screen px-8"
        style={{
          marginLeft: SIDEBAR_WIDTH,
          paddingTop: HEADER_HEIGHT + 32,
          paddingRight: RIGHT_DOCK_GUTTER,
          paddingBottom: PLAYER_HEIGHT + 48,
        }}
      >
        <div className="w-full max-w-[1480px]">
          {error && (
            <div className="mb-5 rounded-md border border-red-300/20 bg-red-950/35 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {activeTab === "discover" ? (
            <div className="space-y-9">
              {continueBook && (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <ContinueReadingHero
                    book={continueBook}
                    onContinue={() => setOpenBook(continueBook)}
                  />
                  <StatsCards
                    readingCount={readingCount}
                    completedCount={completedCount}
                    onOpenLibrary={() => setActiveTab("me")}
                  />
                </div>
              )}

              {loadingData && categories.length === 0 ? (
                <TopicSkeleton />
              ) : (
                <CategoryTopics
                  categories={categories}
                  category={category}
                  setCategory={setCategory}
                />
              )}

              <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 className="font-heading text-[26px] leading-none text-[#f0e6d2]">
                    Được đề xuất cho bạn
                  </h2>
                  <div className="flex items-center gap-3">
                    {loadingData && books.length > 0 && (
                      <span
                        className="flex size-8 items-center justify-center rounded-full border border-[#3a2d1a] bg-[#241b10] text-[#d9b98a]"
                        aria-label="Đang làm mới danh sách"
                      >
                        <Loader2 className="size-3.5 animate-spin" />
                      </span>
                    )}
                    <button
                      onClick={() => setCategory("all")}
                      className="text-sm text-[#d9b98a] transition hover:text-[#e8cf9f]"
                    >
                      Xem tất cả
                    </button>
                  </div>
                </div>

                {loadingData && books.length === 0 ? (
                  <ShelfSkeleton />
                ) : (
                  <>
                    <Bookshelf
                      books={books}
                      savedBookIds={savedBookIds}
                      bookmarkingBookIds={bookmarkingBookIds}
                      showProgress
                      emptyLabel="Chưa tìm thấy sách phù hợp."
                      onOpen={setOpenBook}
                      onToggleBookmark={handleToggleBookmark}
                    />
                    {hasMoreRecommendedBooks && (
                      <div
                        ref={loadMoreRef}
                        className="flex min-h-16 items-center justify-center"
                      >
                        {loadingMoreBooks && (
                          <span
                            className="flex size-9 items-center justify-center rounded-full border border-[#3a2d1a] bg-[#241b10] text-[#d9b98a]"
                            aria-label="Đang tải thêm sách"
                          >
                            <Loader2 className="size-4 animate-spin" />
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <section className="space-y-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a744f]">
                    Thư viện
                  </p>
                  <h2 className="mt-2 font-heading text-[32px] leading-none text-[#f0e6d2]">
                    {libraryTitle}
                  </h2>
                  <p className="mt-3 text-sm text-[#b3a285]">
                    {libraryDescription}
                  </p>
                </div>

                {loadingData && libraryBooks.length === 0 ? (
                  <ShelfSkeleton />
                ) : (
                  <Bookshelf
                    books={libraryBooks}
                    savedBookIds={savedBookIds}
                    bookmarkingBookIds={bookmarkingBookIds}
                    showProgress
                    emptyLabel="Bạn chưa lưu sách nào."
                    onOpen={setOpenBook}
                    onToggleBookmark={handleToggleBookmark}
                  />
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      <aside className="fixed right-6 top-1/2 z-[95] -translate-y-1/2">
        <SpacePanel
          background={background}
          setBackground={setBackground}
          dark={dark}
          setDark={setDark}
          rain={rain}
          setRain={setRain}
        />
      </aside>

      {user && (
        <div className="fixed inset-x-0 bottom-0 z-[85]">
          <MusicPlayer
            playlist={defaultPlaylist}
            onAddTrack={handleAddTrack}
            onRemoveTrack={handleRemoveTrack}
          />
        </div>
      )}

      {openBook && (
        <Reader
          book={openBook}
          onClose={() => setOpenBook(null)}
          onProgressChange={handleProgressChange}
          isBookmarked={savedBookIds.has(openBook.id)}
          isBookmarking={bookmarkingBookIds.has(openBook.id)}
          onToggleBookmark={handleToggleBookmark}
        />
      )}
    </div>
  );
}

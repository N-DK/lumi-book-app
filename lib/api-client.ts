import type {
  Book,
  BookKind,
  ReadingProgress,
  SampleChapter,
  Track,
} from "@/lib/lumi-data"

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: "user" | "admin"
}

export interface ApiBook {
  id: string
  title: string
  slug: string
  author: string
  description?: string
  category?: string
  categories?: string[]
  published?: string
  coverUrl?: string
  sourceUrl?: string
  pdfUrl?: string
  epubUrl?: string
  kind?: BookKind
  spine?: string
  chapters?: SampleChapter[]
  saved?: boolean
  progress?: ReadingProgress | null
}

export interface ApiTrack {
  id: string
  title: string
  artist: string
  audioUrl: string
  coverUrl?: string
  duration?: number
  source?: string
}

export interface ApiPlaylist {
  id: string
  name: string
  description?: string
  isDefault?: boolean
  tracks: ApiTrack[]
}

export interface BookQuery {
  search?: string
  category?: string
  page?: number
  limit?: number
}

export interface BookPayload {
  title: string
  slug?: string
  author?: string
  description?: string
  category?: string
  categories?: string[]
  published?: string
  coverUrl?: string
  sourceUrl?: string
  pdfUrl?: string
  epubUrl?: string
  kind?: BookKind
  spine?: string
  chapters?: SampleChapter[]
}

export interface ProgressPayload {
  currentPage: number
  totalPages: number
  currentChapter?: string
  currentCfi?: string
}

export interface TrackPayload {
  title: string
  artist?: string
  audioUrl: string
  coverUrl?: string
  duration?: number
  source?: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  const hasBody = typeof options.body !== "undefined"

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(data?.message ?? "API request failed", response.status)
  }

  return data as T
}

export function getGoogleLoginUrl() {
  return `${API_BASE_URL}/auth/google`
}

export function getBookReadFormat(
  book: Pick<ApiBook, "kind" | "epubUrl" | "pdfUrl">,
) {
  if (book.kind === "sample") return "sample"
  if (book.kind === "pdf") return "pdf"
  if (book.epubUrl) return "epub"
  return "pdf"
}

export function getBookFileUrl(
  book: Pick<ApiBook, "id" | "kind" | "epubUrl" | "pdfUrl">,
) {
  return `${API_BASE_URL}/books/${book.id}/download?format=${getBookReadFormat(
    book,
  )}`
}

export function toReaderBook(book: ApiBook): Book {
  const kind = getBookReadFormat(book)
  return {
    id: book.id,
    title: book.title,
    slug: book.slug,
    author: book.author,
    description: book.description,
    category: book.category,
    categories: book.categories,
    published: book.published,
    kind,
    spine: book.spine ?? "oklch(0.4 0.08 280)",
    coverUrl: book.coverUrl,
    sourceUrl: book.sourceUrl,
    pdfUrl: book.pdfUrl,
    epubUrl: book.epubUrl,
    fileUrl: kind === "sample" ? undefined : getBookFileUrl(book),
    chapters: book.chapters,
    saved: book.saved,
    progress: book.progress,
  }
}

export function toTrack(track: ApiTrack): Track {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    url: track.audioUrl,
    audioUrl: track.audioUrl,
    coverUrl: track.coverUrl,
  }
}

export async function getCurrentUser() {
  return apiFetch<{ user: AuthUser | null }>("/auth/me")
}

export async function logoutUser() {
  return apiFetch<{ message: string }>("/auth/logout", { method: "POST" })
}

export async function listUsers() {
  return apiFetch<{ users: AuthUser[] }>("/users")
}

export async function getUser(id: string) {
  return apiFetch<{ user: AuthUser }>(`/users/${id}`)
}

export async function updateMe(payload: Partial<Pick<AuthUser, "name" | "avatarUrl">>) {
  return apiFetch<{ user: AuthUser }>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export async function updateUser(
  id: string,
  payload: Partial<Pick<AuthUser, "name" | "avatarUrl" | "role">>,
) {
  return apiFetch<{ user: AuthUser }>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export async function deleteMe() {
  return apiFetch<{ message: string }>("/users/me", { method: "DELETE" })
}

export async function deleteUser(id: string) {
  return apiFetch<{ message: string }>(`/users/${id}`, { method: "DELETE" })
}

export async function listBooks(query: BookQuery = {}) {
  const params = new URLSearchParams()
  if (query.search) params.set("search", query.search)
  if (query.category && query.category !== "all") {
    params.set("category", query.category)
  }
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))

  const suffix = params.toString() ? `?${params.toString()}` : ""
  return apiFetch<{
    books: ApiBook[]
    page?: number
    limit?: number
    total?: number
    hasMore?: boolean
  }>(`/books${suffix}`)
}

export async function listCategories() {
  return apiFetch<{ categories: string[] }>("/books/categories")
}

export async function getBook(id: string) {
  return apiFetch<{ book: ApiBook }>(`/books/${id}`)
}

export async function createBook(payload: BookPayload) {
  return apiFetch<{ book: ApiBook }>("/books", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateBook(id: string, payload: BookPayload) {
  return apiFetch<{ book: ApiBook }>(`/books/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function deleteBook(id: string) {
  return apiFetch<{ message: string }>(`/books/${id}`, { method: "DELETE" })
}

export async function listBookmarks() {
  return apiFetch<{ books: ApiBook[] }>("/bookmarks")
}

export async function saveBookmark(bookId: string) {
  return apiFetch<{ book: ApiBook }>("/bookmarks", {
    method: "POST",
    body: JSON.stringify({ bookId }),
  })
}

export async function removeBookmark(bookId: string) {
  return apiFetch<{ message: string }>(`/bookmarks/${bookId}`, {
    method: "DELETE",
  })
}

export async function listReadingProgress() {
  return apiFetch<{ progress: ReadingProgress[] }>("/progress")
}

export async function getReadingProgress(bookId: string) {
  return apiFetch<{ progress: ReadingProgress | null }>(`/progress/${bookId}`)
}

export async function saveReadingProgress(
  bookId: string,
  payload: ProgressPayload,
) {
  return apiFetch<{ progress: ReadingProgress }>(`/progress/${bookId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function deleteReadingProgress(bookId: string) {
  return apiFetch<{ message: string }>(`/progress/${bookId}`, {
    method: "DELETE",
  })
}

export async function listPlaylists() {
  return apiFetch<{ playlists: ApiPlaylist[] }>("/playlists")
}

export async function createPlaylist(payload: {
  name: string
  description?: string
}) {
  return apiFetch<{ playlist: ApiPlaylist }>("/playlists", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updatePlaylist(
  playlistId: string,
  payload: { name?: string; description?: string },
) {
  return apiFetch<{ playlist: ApiPlaylist }>(`/playlists/${playlistId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export async function deletePlaylist(playlistId: string) {
  return apiFetch<{ message: string }>(`/playlists/${playlistId}`, {
    method: "DELETE",
  })
}

export async function addTrackToPlaylist(
  playlistId: string,
  payload: TrackPayload,
) {
  return apiFetch<{ playlist: ApiPlaylist; track: ApiTrack }>(
    `/playlists/${playlistId}/tracks`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  )
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
) {
  return apiFetch<{ playlist: ApiPlaylist; message: string }>(
    `/playlists/${playlistId}/tracks/${trackId}`,
    { method: "DELETE" },
  )
}

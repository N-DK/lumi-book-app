"use client";

import { Bookshelf } from "@/components/bookshelf";
import { MusicPlayer } from "@/components/music-player";
import { RainOverlay } from "@/components/rain-overlay";
import { Reader } from "@/components/reader";
import { SpacePanel } from "@/components/space-panel";
import { dataUrlToBlob, getStoredFile, putStoredFile } from "@/lib/file-storage";
import { PRESET_SCENES, randomSpine, type Book } from "@/lib/lumi-data";
import { Moon } from "lucide-react";
import { useEffect, useState } from "react";

const BOOKS_STORAGE_KEY = "lumi:books:v1";
const SPACE_STORAGE_KEY = "lumi:space:v1";

type StoredBook = Omit<Book, "chapters" | "file" | "fileUrl"> & {
  fileUrl?: string;
};

interface StoredSpace {
  background: string;
  dark: boolean;
  rain: boolean;
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Không đọc được file."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Không đọc được file."));
    reader.readAsDataURL(blob);
  });
}

function isStoredBook(value: unknown): value is StoredBook {
  if (!value || typeof value !== "object") return false;
  const book = value as Partial<StoredBook>;
  return (
    typeof book.id === "string" &&
    typeof book.title === "string" &&
    typeof book.author === "string" &&
    (book.kind === "pdf" || book.kind === "epub") &&
    typeof book.spine === "string"
  );
}

function bookFileKey(id: string) {
  return `book:${id}:file`;
}

function bookCoverKey(id: string) {
  return `book:${id}:cover`;
}

function saveLocalStorageJson(key: string, value: unknown) {
  localStorage.removeItem(key);
  localStorage.setItem(key, JSON.stringify(value));
}

async function readEpubCoverBlob(file: File) {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const parser = new DOMParser();
    const containerXml = await zip
      .file("META-INF/container.xml")
      ?.async("text");
    if (!containerXml) return undefined;

    const containerDoc = parser.parseFromString(containerXml, "application/xml");
    const opfPath = containerDoc
      .querySelector("rootfile")
      ?.getAttribute("full-path");
    if (!opfPath) return undefined;

    const opfXml = await zip.file(opfPath)?.async("text");
    if (!opfXml) return undefined;

    const opfDoc = parser.parseFromString(opfXml, "application/xml");
    const coverItem =
      opfDoc.querySelector("item[properties~='cover-image']") ??
      (() => {
        const coverId = opfDoc
          .querySelector("meta[name='cover']")
          ?.getAttribute("content");
        return coverId
          ? Array.from(opfDoc.querySelectorAll("item")).find(
              (item) => item.getAttribute("id") === coverId,
            ) ?? null
          : null;
      })();
    if (!coverItem) return undefined;

    const coverHref = coverItem?.getAttribute("href");
    if (!coverHref) return undefined;

    const coverPath = resolveEpubAssetPath(opfPath, coverHref);
    const coverFile =
      zip.file(coverPath) ?? zip.file(decodeURIComponent(coverPath));
    if (!coverFile) return undefined;

    const coverBlob = await coverFile.async("blob");
    return coverBlob.slice(
      0,
      coverBlob.size,
      coverItem.getAttribute("media-type") ?? "image/*",
    );
  } catch (error) {
    console.warn("Không lấy được bìa EPUB.", error);
    return undefined;
  }
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

export default function Page() {
  const [books, setBooks] = useState<Book[]>([]);
  const [openBook, setOpenBook] = useState<Book | null>(null);
  const [background, setBackground] = useState(PRESET_SCENES[0].css);
  const [dark, setDark] = useState(true);
  const [rain, setRain] = useState(true);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
    try {
      const savedSpace = localStorage.getItem(SPACE_STORAGE_KEY);
      if (savedSpace) {
        const parsed = JSON.parse(savedSpace) as Partial<StoredSpace>;
        if (typeof parsed.background === "string")
          setBackground(parsed.background);
        if (typeof parsed.dark === "boolean") setDark(parsed.dark);
        if (typeof parsed.rain === "boolean") setRain(parsed.rain);
      }

      const savedBooks = localStorage.getItem(BOOKS_STORAGE_KEY);
      if (savedBooks) {
        const parsed = JSON.parse(savedBooks);
        if (Array.isArray(parsed)) {
          const saved = parsed.filter(isStoredBook);
          const restored = await Promise.all(
            saved.map(async (book): Promise<Book | null> => {
              let file: Blob | undefined;

              if (book.fileUrl?.startsWith("data:")) {
                file = dataUrlToBlob(book.fileUrl);
                await putStoredFile(bookFileKey(book.id), file);
              } else {
                file =
                  (await getStoredFile(bookFileKey(book.id))) ??
                  (await getStoredFile(book.id));
              }

              if (!file) return null;

              let coverUrl = book.coverUrl;
              if (book.coverUrl?.startsWith("data:")) {
                const cover = dataUrlToBlob(book.coverUrl);
                await putStoredFile(bookCoverKey(book.id), cover);
                coverUrl = URL.createObjectURL(cover);
              } else {
                const cover = await getStoredFile(bookCoverKey(book.id));
                coverUrl = cover ? URL.createObjectURL(cover) : undefined;
              }

              return {
                ...book,
                fileUrl: URL.createObjectURL(file),
                coverUrl,
              };
            }),
          );

          if (!cancelled) {
            setBooks(restored.filter((book): book is Book => book !== null));
          }
        }
      }
    } catch (error) {
      console.warn("Không khôi phục được dữ liệu đã lưu.", error);
    } finally {
      if (!cancelled) setStorageReady(true);
    }

    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      const importedBooks: StoredBook[] = books
        .filter((book) => book.kind !== "sample" && book.fileUrl)
        .map(
          ({
            chapters: _chapters,
            file: _file,
            fileUrl: _fileUrl,
            coverUrl: _coverUrl,
            ...book
          }) => book,
        );
      saveLocalStorageJson(BOOKS_STORAGE_KEY, importedBooks);
    } catch (error) {
      console.warn("Không lưu được sách vào localStorage.", error);
    }
  }, [books, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(
        SPACE_STORAGE_KEY,
        JSON.stringify({ background, dark, rain } satisfies StoredSpace),
      );
    } catch (error) {
      console.warn("Không lưu được không gian đọc vào localStorage.", error);
    }
  }, [background, dark, rain, storageReady]);

  async function handleImport(files: FileList | null) {
    if (!files?.length) return;

    try {
      const uploadedAt = Date.now();
      const next: Book[] = await Promise.all(
        Array.from(files).map(async (f, i) => {
          const isEpub =
            f.type === "application/epub+zip" ||
            f.name.toLowerCase().endsWith(".epub");
          const id = `${uploadedAt}-${i}`;
          const [fileUrl, coverBlob] = await Promise.all([
            Promise.resolve(URL.createObjectURL(f)),
            isEpub ? readEpubCoverBlob(f) : Promise.resolve(undefined),
          ]);
          await putStoredFile(bookFileKey(id), f);
          if (coverBlob) await putStoredFile(bookCoverKey(id), coverBlob);

          return {
            id,
            title: f.name.replace(/\.[^.]+$/, ""),
            author: "Tủ sách của bạn",
            kind: isEpub ? "epub" : "pdf",
            spine: randomSpine(books.length + i),
            coverUrl: coverBlob ? URL.createObjectURL(coverBlob) : undefined,
            file: f,
            fileUrl,
          };
        }),
      );

      setBooks((prev) => [...prev, ...next]);
    } catch (error) {
      console.warn("Không import được sách.", error);
    }
  }

  return (
    <div className="relative min-h-screen w-full" style={{ background }}>
      {/* lớp phủ tối để dễ đọc chữ */}
      <div className="absolute inset-0 bg-background/35" />
      <RainOverlay enabled={rain} />

      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 pb-36 pt-8 sm:px-6 lg:flex-row lg:px-8">
        {/* nội dung chính */}
        <section className="flex-1">
          <header className="mb-8 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full border border-primary/40 bg-card/60 text-primary backdrop-blur-md">
              <Moon className="size-5" />
            </span>
            <div>
              <h1 className="font-heading text-3xl tracking-tight text-foreground">
                LUMI
              </h1>
              {/* <p className="text-sm text-muted-foreground">
                góc đọc ban đêm của bạn
              </p> */}
            </div>
          </header>

          <Bookshelf
            books={books}
            onOpen={setOpenBook}
            onImport={handleImport}
          />
        </section>

        {/* thanh bên */}
        <aside className="flex w-full shrink-0 flex-col gap-5 lg:w-80 fixed right-10 top-[50%] -translate-y-1/2">
          <SpacePanel
            background={background}
            setBackground={setBackground}
            dark={dark}
            setDark={setDark}
            rain={rain}
            setRain={setRain}
          />
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 py-3 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <MusicPlayer />
        </div>
      </div>

      {openBook && <Reader book={openBook} onClose={() => setOpenBook(null)} />}
    </div>
  );
}

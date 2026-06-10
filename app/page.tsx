"use client";

import { Bookshelf } from "@/components/bookshelf";
import { MusicPlayer } from "@/components/music-player";
import { RainOverlay } from "@/components/rain-overlay";
import { Reader } from "@/components/reader";
import { SpacePanel } from "@/components/space-panel";
import {
  PRESET_SCENES,
  SAMPLE_BOOKS,
  randomSpine,
  type Book,
} from "@/lib/lumi-data";
import { Moon } from "lucide-react";
import { useEffect, useState } from "react";

const BOOKS_STORAGE_KEY = "lumi:books:v1";
const SPACE_STORAGE_KEY = "lumi:space:v1";

type StoredBook = Omit<Book, "chapters" | "file">;

interface StoredSpace {
  background: string;
  dark: boolean;
  rain: boolean;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Không đọc được file."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Không đọc được file."));
    reader.readAsDataURL(file);
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
    typeof book.spine === "string" &&
    typeof book.fileUrl === "string"
  );
}

export default function Page() {
  const [books, setBooks] = useState<Book[]>(SAMPLE_BOOKS);
  const [openBook, setOpenBook] = useState<Book | null>(null);
  const [background, setBackground] = useState(PRESET_SCENES[0].css);
  const [dark, setDark] = useState(true);
  const [rain, setRain] = useState(true);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
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
          setBooks([...SAMPLE_BOOKS, ...parsed.filter(isStoredBook)]);
        }
      }
    } catch (error) {
      console.warn("Không khôi phục được dữ liệu đã lưu.", error);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      const importedBooks: StoredBook[] = books
        .filter((book) => book.kind !== "sample" && book.fileUrl)
        .map(({ chapters: _chapters, file: _file, ...book }) => book);
      localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(importedBooks));
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

          return {
            id: `${uploadedAt}-${i}`,
            title: f.name.replace(/\.[^.]+$/, ""),
            author: "Tủ sách của bạn",
            kind: isEpub ? "epub" : "pdf",
            spine: randomSpine(books.length + i),
            file: f,
            fileUrl: await readFileAsDataUrl(f),
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

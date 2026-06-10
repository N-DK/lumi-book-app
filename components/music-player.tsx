"use client";

import { dataUrlToBlob, getStoredFile, putStoredFile } from "@/lib/file-storage";
import type { Track } from "@/lib/lumi-data";
import { cn } from "@/lib/utils";
import {
  ListMusic,
  Pause,
  Play,
  Plus,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MUSIC_STORAGE_KEY = "lumi:music:v1";

type StoredTrack = Omit<Track, "url"> & {
  url?: string;
};

interface StoredMusicState {
  tracks: StoredTrack[];
  current: number;
  loop: boolean;
  volume: number;
}

function formatTime(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Không đọc được file nhạc."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Không đọc được file nhạc."));
    reader.readAsDataURL(blob);
  });
}

function isStoredTrack(value: unknown): value is StoredTrack {
  if (!value || typeof value !== "object") return false;
  const track = value as Partial<Track>;
  return (
    typeof track.id === "string" &&
    typeof track.title === "string" &&
    typeof track.artist === "string"
  );
}

function trackFileKey(id: string) {
  return `track:${id}:file`;
}

function trackCoverKey(id: string) {
  return `track:${id}:cover`;
}

function saveLocalStorageJson(key: string, value: unknown) {
  localStorage.removeItem(key);
  localStorage.setItem(key, JSON.stringify(value));
}

function clampIndex(index: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

function readSynchsafe(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] << 21) |
    (bytes[offset + 1] << 14) |
    (bytes[offset + 2] << 7) |
    bytes[offset + 3]
  );
}

function readFrameSize(bytes: Uint8Array, offset: number, version: number) {
  if (version === 4) return readSynchsafe(bytes, offset);
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  );
}

function findTextTerminator(bytes: Uint8Array, start: number, wide: boolean) {
  for (let i = start; i < bytes.length; i += wide ? 2 : 1) {
    if (!wide && bytes[i] === 0) return i;
    if (wide && bytes[i] === 0 && bytes[i + 1] === 0) return i;
  }
  return -1;
}

async function readAudioCoverBlob(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (
    bytes.length < 10 ||
    bytes[0] !== 0x49 ||
    bytes[1] !== 0x44 ||
    bytes[2] !== 0x33
  ) {
    return undefined;
  }

  const version = bytes[3];
  const tagEnd = Math.min(bytes.length, 10 + readSynchsafe(bytes, 6));
  let offset = 10;

  while (offset + 10 <= tagEnd) {
    const frameId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    const frameSize = readFrameSize(bytes, offset + 4, version);
    const frameStart = offset + 10;
    const frameEnd = Math.min(frameStart + frameSize, tagEnd);
    if (!frameId.trim() || frameSize <= 0 || frameEnd <= frameStart) break;

    if (frameId === "APIC") {
      const frame = bytes.slice(frameStart, frameEnd);
      const encoding = frame[0];
      const mimeEnd = findTextTerminator(frame, 1, false);
      if (mimeEnd < 0) return undefined;

      const mime = new TextDecoder("latin1").decode(frame.slice(1, mimeEnd));
      const descriptionStart = mimeEnd + 2;
      const wide = encoding === 1 || encoding === 2;
      const descriptionEnd = findTextTerminator(frame, descriptionStart, wide);
      const imageStart =
        descriptionEnd >= 0
          ? descriptionEnd + (wide ? 2 : 1)
          : descriptionStart;
      const image = frame.slice(imageStart);
      if (image.length === 0) return undefined;

      return new Blob([image], { type: mime || "image/*" });
    }

    offset = frameEnd;
  }

  return undefined;
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [showList, setShowList] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  const track = tracks[current];

  useEffect(() => {
    let cancelled = false;

    async function restore() {
    try {
      const savedMusic = localStorage.getItem(MUSIC_STORAGE_KEY);
      if (!savedMusic) return;

      const parsed = JSON.parse(savedMusic) as Partial<StoredMusicState>;
      const savedTracks = Array.isArray(parsed.tracks)
        ? parsed.tracks.filter(isStoredTrack)
        : [];
      const restoredTracks = (
        await Promise.all(
          savedTracks.map(async (track): Promise<Track | null> => {
            let file: Blob | undefined;

            if (track.url?.startsWith("data:")) {
              file = dataUrlToBlob(track.url);
              await putStoredFile(trackFileKey(track.id), file);
            } else {
              file =
                (await getStoredFile(trackFileKey(track.id))) ??
                (await getStoredFile(track.id));
            }

            if (!file) return null;

            let coverUrl = track.coverUrl;
            if (track.coverUrl?.startsWith("data:")) {
              const cover = dataUrlToBlob(track.coverUrl);
              await putStoredFile(trackCoverKey(track.id), cover);
              coverUrl = URL.createObjectURL(cover);
            } else {
              const cover = await getStoredFile(trackCoverKey(track.id));
              coverUrl = cover ? URL.createObjectURL(cover) : undefined;
            }

            return {
              ...track,
              url: URL.createObjectURL(file),
              coverUrl,
            };
          }),
        )
      ).filter((track): track is Track => track !== null);

      if (!cancelled) {
        setTracks(restoredTracks);
        setCurrent(
          clampIndex(Number(parsed.current) || 0, restoredTracks.length),
        );
        if (typeof parsed.loop === "boolean") setLoop(parsed.loop);
        if (typeof parsed.volume === "number") {
          setVolume(Math.min(Math.max(parsed.volume, 0), 1));
        }
      }
    } catch (error) {
      console.warn("Không khôi phục được playlist đã lưu.", error);
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
      const storedTracks: StoredTrack[] = tracks.map(
        ({ url: _url, coverUrl: _coverUrl, ...track }) => track,
      );

      saveLocalStorageJson(
        MUSIC_STORAGE_KEY,
        {
          tracks: storedTracks,
          current: clampIndex(current, tracks.length),
          loop,
          volume,
        } satisfies StoredMusicState,
      );
    } catch (error) {
      console.warn("Không lưu được nhạc vào localStorage.", error);
    }
  }, [current, loop, storageReady, tracks, volume]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
  }, [volume]);

  useEffect(() => {
    setProgress(0);
    setDuration(0);
  }, [track?.id]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !track) return;
    if (playing) {
      void a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }, [playing, track]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    try {
      const uploadedAt = Date.now();
      const next: Track[] = await Promise.all(
        Array.from(files).map(async (f, i) => {
          const id = `${uploadedAt}-${i}`;
          const [coverBlob] = await Promise.all([
            readAudioCoverBlob(f),
            putStoredFile(trackFileKey(id), f),
          ]);
          if (coverBlob) await putStoredFile(trackCoverKey(id), coverBlob);

          return {
            id,
            title: f.name.replace(/\.[^.]+$/, ""),
            artist: "Tệp của bạn",
            url: URL.createObjectURL(f),
            coverUrl: coverBlob ? URL.createObjectURL(coverBlob) : undefined,
          };
        }),
      );

      setTracks((prev) => {
        const merged = [...prev, ...next];
        if (prev.length === 0) setCurrent(0);
        return merged;
      });
    } catch (error) {
      console.warn("Không import được nhạc.", error);
    }
  }

  function playIndex(i: number) {
    setCurrent(i);
    setPlaying(true);
  }

  function next() {
    if (tracks.length === 0) return;
    setCurrent((c) => (c + 1) % tracks.length);
    setPlaying(true);
  }

  function prev() {
    if (tracks.length === 0) return;
    setCurrent((c) => (c - 1 + tracks.length) % tracks.length);
    setPlaying(true);
  }

  return (
    <div className="relative rounded-xl border border-border bg-card/30 p-3 backdrop-blur-md">
      <audio
        ref={audioRef}
        src={track?.url}
        loop={loop}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => (loop ? null : next())}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3 lg:w-72">
          <div
            className={cn(
              "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-gradient-to-br from-secondary to-background shadow-inner",
              playing && "lumi-spin",
            )}
          >
            {track?.coverUrl && (
              <img
                src={track.coverUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            )}
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative size-3 rounded-full bg-primary" />
            <div className="absolute inset-2 rounded-full border border-border/60" />
          </div>

          <div className="min-w-0">
            <p className="truncate font-heading text-sm leading-tight text-card-foreground">
              {track ? track.title : "Chưa có bài hát"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {track ? track.artist : "Thêm nhạc để bắt đầu"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={prev}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-card-foreground"
              aria-label="Bài trước"
            >
              <SkipBack className="size-4" />
            </button>
            <button
              onClick={() => setPlaying((p) => !p)}
              disabled={!track}
              className="rounded-full bg-primary p-2.5 text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              aria-label={playing ? "Tạm dừng" : "Phát"}
            >
              {playing ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </button>
            <button
              onClick={next}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-card-foreground"
              aria-label="Bài kế"
            >
              <SkipForward className="size-4" />
            </button>
            <button
              onClick={() => setLoop((l) => !l)}
              className={cn(
                "rounded-lg p-2 transition hover:bg-secondary",
                loop
                  ? "text-primary"
                  : "text-muted-foreground hover:text-card-foreground",
              )}
              aria-label="Lặp lại"
              aria-pressed={loop}
            >
              <Repeat className="size-4" />
            </button>
          </div>

          <span className="hidden w-9 text-right text-[10px] tabular-nums text-muted-foreground sm:block">
            {formatTime(progress)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={progress}
            onChange={(e) => {
              const a = audioRef.current;
              if (a) a.currentTime = Number(e.target.value);
              setProgress(Number(e.target.value));
            }}
            className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-primary"
            aria-label="Tua bài hát"
          />
          <span className="hidden w-9 text-[10px] tabular-nums text-muted-foreground sm:block">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 lg:w-72 lg:justify-end">
          <div className="hidden items-center gap-2 sm:flex">
            <Volume2 className="size-4 text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-primary"
              aria-label="Âm lượng"
            />
          </div>
          <button
            onClick={() => setShowList((s) => !s)}
            className={cn(
              "rounded-lg p-2 transition hover:bg-secondary",
              showList
                ? "text-primary"
                : "text-muted-foreground hover:text-card-foreground",
            )}
            aria-label="Danh sách bài"
            aria-pressed={showList}
          >
            <ListMusic className="size-4" />
          </button>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-primary hover:text-card-foreground">
            <Plus className="size-3.5" />
            Thêm nhạc
            <input
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {showList && (
        <div className="absolute inset-x-0 bottom-full mb-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-popover/95 p-2 shadow-2xl backdrop-blur-md lumi-scroll">
          {tracks.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              Danh sách trống.
            </p>
          )}
          {tracks.map((t, i) => (
            <button
              key={t.id}
              onClick={() => playIndex(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition hover:bg-secondary",
                i === current && "bg-secondary text-primary",
              )}
            >
              <span className="flex w-6 shrink-0 justify-center text-muted-foreground">
                {i === current && playing ? (
                  <span className="flex h-3 items-end justify-center gap-[2px]">
                    <span
                      className="w-[2px] bg-primary"
                      style={{ animation: "lumi-eq 0.8s ease-in-out infinite" }}
                    />
                    <span
                      className="w-[2px] bg-primary"
                      style={{
                        animation: "lumi-eq 0.8s ease-in-out 0.2s infinite",
                      }}
                    />
                    <span
                      className="w-[2px] bg-primary"
                      style={{
                        animation: "lumi-eq 0.8s ease-in-out 0.4s infinite",
                      }}
                    />
                  </span>
                ) : (
                  t.coverUrl ? (
                    <img
                      src={t.coverUrl}
                      alt=""
                      className="size-5 rounded-sm object-cover"
                      draggable={false}
                    />
                  ) : (
                    i + 1
                  )
                )}
              </span>
              <span className="truncate">{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

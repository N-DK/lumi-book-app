"use client";

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

interface StoredMusicState {
  tracks: Track[];
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Không đọc được file nhạc."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Không đọc được file nhạc."));
    reader.readAsDataURL(file);
  });
}

function isStoredTrack(value: unknown): value is Track {
  if (!value || typeof value !== "object") return false;
  const track = value as Partial<Track>;
  return (
    typeof track.id === "string" &&
    typeof track.title === "string" &&
    typeof track.artist === "string" &&
    typeof track.url === "string"
  );
}

function clampIndex(index: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
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
    try {
      const savedMusic = localStorage.getItem(MUSIC_STORAGE_KEY);
      if (!savedMusic) return;

      const parsed = JSON.parse(savedMusic) as Partial<StoredMusicState>;
      const savedTracks = Array.isArray(parsed.tracks)
        ? parsed.tracks.filter(isStoredTrack)
        : [];

      setTracks(savedTracks);
      setCurrent(clampIndex(Number(parsed.current) || 0, savedTracks.length));
      if (typeof parsed.loop === "boolean") setLoop(parsed.loop);
      if (typeof parsed.volume === "number") {
        setVolume(Math.min(Math.max(parsed.volume, 0), 1));
      }
    } catch (error) {
      console.warn("Không khôi phục được playlist đã lưu.", error);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(
        MUSIC_STORAGE_KEY,
        JSON.stringify({
          tracks,
          current: clampIndex(current, tracks.length),
          loop,
          volume,
        } satisfies StoredMusicState),
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
        Array.from(files).map(async (f, i) => ({
          id: `${uploadedAt}-${i}`,
          title: f.name.replace(/\.[^.]+$/, ""),
          artist: "Tệp của bạn",
          url: await readFileAsDataUrl(f),
        })),
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
              "relative flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-gradient-to-br from-secondary to-background shadow-inner",
              playing && "lumi-spin",
            )}
          >
            <div className="size-3 rounded-full bg-primary" />
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
              <span className="w-4 text-center text-muted-foreground">
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
                  i + 1
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

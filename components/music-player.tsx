"use client";

import { ProgressSlider } from "@/components/progress-slider";
import type {
  ApiPlaylist,
  ApiTrack,
  TrackPayload,
  YoutubeTrackInfo,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  Link as LinkIcon,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Plus,
  Repeat,
  Save,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

interface MusicPlayerProps {
  playlist?: ApiPlaylist;
  onAddTrack: (payload: TrackPayload) => Promise<void>;
  onRemoveTrack: (trackId: string) => Promise<void>;
  onResolveYoutubeUrl: (url: string) => Promise<YoutubeTrackInfo>;
}

function formatTime(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function clampIndex(index: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Không xử lý được bài nhạc này.";
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

export function MusicPlayer({
  playlist,
  onAddTrack,
  onRemoveTrack,
  onResolveYoutubeUrl,
}: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [showList, setShowList] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [removingTrackId, setRemovingTrackId] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubePreview, setYoutubePreview] =
    useState<YoutubeTrackInfo | null>(null);
  const [addError, setAddError] = useState("");

  const tracks = playlist?.tracks ?? [];
  const track = tracks[current];
  const previewTrack = useMemo<ApiTrack | null>(() => {
    if (!youtubePreview) return null;
    return {
      id: `youtube-preview-${youtubePreview.sourceUrl}`,
      title: youtubePreview.title,
      artist: youtubePreview.artist,
      audioUrl: youtubePreview.audioUrl,
      coverUrl: youtubePreview.coverUrl,
      duration: youtubePreview.duration,
      source: "youtube-preview",
      sourceUrl: youtubePreview.sourceUrl,
    };
  }, [youtubePreview]);
  const activeTrack = previewTrack ?? track;
  const isPreviewing = Boolean(previewTrack);

  useEffect(() => {
    setCurrent((index) => clampIndex(index, tracks.length));
  }, [tracks.length]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
  }, [volume]);

  useEffect(() => {
    setProgress(0);
    setDuration(activeTrack?.duration ?? 0);
  }, [activeTrack?.id, activeTrack?.duration]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !activeTrack) return;
    if (playing) {
      void a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }, [playing, activeTrack]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    setSaving(true);
    setAddError("");
    try {
      for (const file of Array.from(files)) {
        const [audioUrl, coverBlob] = await Promise.all([
          readBlobAsDataUrl(file),
          readAudioCoverBlob(file),
        ]);
        const coverUrl = coverBlob ? await readBlobAsDataUrl(coverBlob) : "";

        await onAddTrack({
          title: file.name.replace(/\.[^.]+$/, ""),
          artist: "Tệp của bạn",
          audioUrl,
          coverUrl,
          source: "upload",
        });
      }

      setYoutubePreview(null);
      setYoutubeUrl("");
      setShowAdd(false);
    } catch (error) {
      setAddError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleResolveYoutube(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = youtubeUrl.trim();
    if (!url) return;

    setResolving(true);
    setAddError("");
    try {
      const trackInfo = await onResolveYoutubeUrl(url);
      setYoutubePreview(trackInfo);
      setShowList(false);
      setPlaying(true);
    } catch (error) {
      setYoutubePreview(null);
      setAddError(getErrorMessage(error));
      setPlaying(false);
    } finally {
      setResolving(false);
    }
  }

  async function handleSaveYoutube() {
    if (!youtubePreview) return;

    setSaving(true);
    setAddError("");
    try {
      await onAddTrack({
        title: youtubePreview.title,
        artist: youtubePreview.artist,
        audioUrl: youtubePreview.audioUrl,
        coverUrl: youtubePreview.coverUrl,
        duration: youtubePreview.duration,
        source: "youtube",
        sourceUrl: youtubePreview.sourceUrl,
      });
      setYoutubePreview(null);
      setYoutubeUrl("");
      setPlaying(false);
      setShowAdd(false);
    } catch (error) {
      setAddError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function removeTrack(trackId: string) {
    setRemovingTrackId(trackId);
    try {
      await onRemoveTrack(trackId);
    } finally {
      setRemovingTrackId("");
    }
  }

  function playIndex(i: number) {
    setYoutubePreview(null);
    setCurrent(i);
    setPlaying(true);
  }

  function next() {
    if (tracks.length === 0) return;
    setYoutubePreview(null);
    setCurrent((index) => (index + 1) % tracks.length);
    setPlaying(true);
  }

  function prev() {
    if (tracks.length === 0) return;
    setYoutubePreview(null);
    setCurrent((index) => (index - 1 + tracks.length) % tracks.length);
    setPlaying(true);
  }

  function handleEnded() {
    if (loop) return;
    if (isPreviewing) {
      setPlaying(false);
      return;
    }
    next();
  }

  return (
    <div className="relative border-t border-[#2b2115] bg-[#16110a]/[0.97] px-6 py-3 text-[#ecdfc5] backdrop-blur-xl">
      <audio
        ref={audioRef}
        src={activeTrack?.audioUrl}
        loop={loop}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
      />

      <div className="flex items-center gap-6">
        <div className="flex w-64 min-w-0 shrink-0 items-center gap-3">
          <div
            className={cn(
              "relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#3a2d1a] bg-gradient-to-br from-[#2b2115] to-[#120d07] shadow-inner",
              playing && "lumi-spin",
            )}
          >
            {activeTrack?.coverUrl ? (
              <img
                src={activeTrack.coverUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <span className="text-[7px] font-semibold uppercase tracking-[0.28em] text-[#a8895c]">
                Vinyl
              </span>
            )}
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute inset-2 rounded-full border border-white/[0.12]" />
          </div>

          <div className="min-w-0">
            <p className="truncate font-heading text-sm leading-tight text-[#f0e6d2]">
              {activeTrack ? activeTrack.title : "Chưa có bài hát"}
            </p>
            <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.24em] text-[#a8895c]">
              {activeTrack
                ? isPreviewing
                  ? `${activeTrack.artist} · nghe thử`
                  : activeTrack.artist
                : "Thêm nhạc để bắt đầu"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              className="rounded-full p-2 text-[#a3937a] transition hover:bg-white/[0.06] hover:text-[#ecdfc5]"
              aria-label="Bài trước"
            >
              <SkipBack className="size-4" />
            </button>
            <button
              onClick={() => setPlaying((value) => !value)}
              disabled={!activeTrack}
              className="flex size-11 items-center justify-center rounded-full bg-[#d9b98a] text-[#241b10] shadow-[0_8px_24px_rgba(217,185,138,0.25)] transition hover:brightness-110 disabled:opacity-40"
              aria-label={playing ? "Tạm dừng" : "Phát"}
            >
              {playing ? (
                <Pause className="size-5" />
              ) : (
                <Play className="ml-0.5 size-5" />
              )}
            </button>
            <button
              onClick={next}
              className="rounded-full p-2 text-[#a3937a] transition hover:bg-white/[0.06] hover:text-[#ecdfc5]"
              aria-label="Bài kế"
            >
              <SkipForward className="size-4" />
            </button>
            <button
              onClick={() => setLoop((value) => !value)}
              className={cn(
                "rounded-full p-2 transition hover:bg-white/[0.06]",
                loop ? "text-[#d9b98a]" : "text-[#a3937a] hover:text-[#ecdfc5]",
              )}
              aria-label="Lặp lại"
              aria-pressed={loop}
            >
              <Repeat className="size-4" />
            </button>
          </div>

          <div className="flex w-full max-w-xl items-center gap-3">
            <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-[#8a744f]">
              {formatTime(progress)}
            </span>
            <ProgressSlider
              min={0}
              max={duration || 0}
              value={progress}
              step={1}
              disabled={!activeTrack || duration <= 0}
              onChange={(value) => {
                const audio = audioRef.current;
                if (audio) audio.currentTime = value;
                setProgress(value);
              }}
              className="flex-1"
              ariaLabel="Tua bài hát"
              valueLabel={`${formatTime(progress)} / ${formatTime(duration)}`}
            />
            <span className="w-9 shrink-0 text-[10px] tabular-nums text-[#8a744f]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="flex w-64 shrink-0 items-center justify-end gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <Volume2 className="size-4 text-[#a3937a]" />
            <ProgressSlider
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={setVolume}
              className="w-20"
              ariaLabel="Âm lượng"
              valueLabel={`${Math.round(volume * 100)}%`}
            />
          </div>
          <button
            onClick={() => setShowList((value) => !value)}
            className={cn(
              "rounded-full p-2 transition hover:bg-white/[0.06]",
              showList
                ? "text-[#d9b98a]"
                : "text-[#a3937a] hover:text-[#ecdfc5]",
            )}
            aria-label="Danh sách bài"
            aria-pressed={showList}
          >
            <ListMusic className="size-4" />
          </button>

          <button
            onClick={() => {
              setShowAdd((value) => !value);
              setShowList(false);
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-[#3a2d1a] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition hover:border-[#d9b98a]/50 hover:text-[#ecdfc5]",
              showAdd ? "text-[#d9b98a]" : "text-[#a3937a]",
            )}
            aria-label="Thêm nhạc"
            aria-pressed={showAdd}
          >
            {saving || resolving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Thêm nhạc
          </button>
        </div>
      </div>

      {showAdd && (
        <form
          onSubmit={(event) => void handleResolveYoutube(event)}
          className="absolute bottom-full right-6 mb-3 w-[min(680px,calc(100vw-2rem))] rounded-2xl border border-white/[0.10] bg-[#1d160d]/95 p-4 text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 rounded-xl border border-[#3a2d1a] bg-black/[0.28] px-3">
            <LinkIcon className="size-4 shrink-0 text-[#d9b98a]" />
            <input
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setAddError("");
              }}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              placeholder="Dán URL YouTube để nghe thử..."
            />
            <button
              type="submit"
              disabled={resolving || !youtubeUrl.trim()}
              className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#d9b98a] px-3 text-xs font-semibold text-[#241b10] transition hover:brightness-110 disabled:opacity-40"
            >
              {resolving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Nghe thử
            </button>
          </div>

          {addError && (
            <p className="mt-3 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs text-red-100">
              {addError}
            </p>
          )}

          {youtubePreview && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#3a2d1a] bg-[#241b10]/70 p-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/[0.10] bg-black/30">
                {youtubePreview.coverUrl ? (
                  <img
                    src={youtubePreview.coverUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-base text-[#f0e6d2]">
                  {youtubePreview.title}
                </p>
                <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a8895c]">
                  {youtubePreview.artist} · {formatTime(youtubePreview.duration ?? 0)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSaveYoutube()}
                disabled={saving}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#d9b98a]/40 bg-[#d9b98a]/[0.12] px-4 text-xs font-semibold text-[#e9d2a6] transition hover:bg-[#d9b98a]/[0.20] disabled:opacity-45"
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Lưu vào Nhạc yêu thích
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
            <p className="text-[11px] text-white/[0.42]">
              Chỉ lưu những bài bạn có quyền sử dụng.
            </p>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/[0.14] px-3 py-2 text-xs text-white/50 transition hover:border-[#d9b98a] hover:text-white">
              <Upload className="size-3.5" />
              Tệp nhạc
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
        </form>
      )}

      {showList && (
        <div className="absolute inset-x-0 bottom-full mb-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/[0.10] bg-[#1d160d]/95 p-2 text-white shadow-2xl backdrop-blur-xl lumi-scroll">
          {tracks.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-white/45">
              Danh sách trống.
            </p>
          )}
          {tracks.map((item: ApiTrack, i) => (
            <div
              key={item.id}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition hover:bg-white/[0.08]",
                i === current &&
                  !isPreviewing &&
                  "bg-white/[0.08] text-[#d9b98a]",
              )}
            >
              <button
                onClick={() => playIndex(i)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="flex w-6 shrink-0 justify-center text-white/45">
                  {i === current && playing && !isPreviewing ? (
                    <span className="flex h-3 items-end justify-center gap-[2px]">
                      <span
                        className="w-[2px] bg-[#d9b98a]"
                        style={{ animation: "lumi-eq 0.8s ease-in-out infinite" }}
                      />
                      <span
                        className="w-[2px] bg-[#d9b98a]"
                        style={{
                          animation: "lumi-eq 0.8s ease-in-out 0.2s infinite",
                        }}
                      />
                      <span
                        className="w-[2px] bg-[#d9b98a]"
                        style={{
                          animation: "lumi-eq 0.8s ease-in-out 0.4s infinite",
                        }}
                      />
                    </span>
                  ) : item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt=""
                      className="size-5 rounded-sm object-cover"
                      draggable={false}
                    />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="truncate">{item.title}</span>
              </button>
              <button
                onClick={() => void removeTrack(item.id)}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-white/[0.42] transition hover:bg-red-400/10 hover:text-red-200"
                aria-label={`Xóa ${item.title}`}
                disabled={removingTrackId === item.id}
              >
                {removingTrackId === item.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

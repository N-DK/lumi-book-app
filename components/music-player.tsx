"use client";

import { ProgressSlider } from "@/components/progress-slider";
import type {
  ApiPlaylist,
  ApiTrack,
  TrackPayload,
  YoutubeSearchResult,
  YoutubeTrackInfo,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  Eye,
  EyeOff,
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
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

interface MusicPlayerProps {
  playlist?: ApiPlaylist;
  onAddTrack: (payload: TrackPayload) => Promise<void>;
  onRemoveTrack: (trackId: string) => Promise<void>;
  onResolveYoutubeUrl: (url: string) => Promise<YoutubeTrackInfo>;
  onSearchYoutube: (
    query: string,
    options?: { limit?: number; offset?: number },
  ) => Promise<YoutubeSearchResult>;
}

const YOUTUBE_SEARCH_PAGE_SIZE = 5;

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

function getYoutubeVideoId(value: string) {
  if (!value.trim()) return "";

  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? "";
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      const watchId = url.searchParams.get("v");
      if (watchId) return watchId;

      const [kind, id] = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(kind ?? "") && id) return id;
    }
  } catch {
    return "";
  }

  return "";
}

function getYoutubeWatchUrl(value: string) {
  const videoId = getYoutubeVideoId(value);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : value.trim();
}

function getYoutubeCoverUrl(value: string) {
  const videoId = getYoutubeVideoId(value);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "";
}

function getYoutubeEmbedUrl(value: string, autoplay = false) {
  const videoId = getYoutubeVideoId(value);
  if (!videoId) return "";

  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
  });
  if (autoplay) params.set("autoplay", "1");

  return `https://www.youtube.com/embed/${videoId}?${params}`;
}

function isYoutubeTrack(
  track?: Pick<ApiTrack, "source" | "audioUrl" | "sourceUrl"> | null,
) {
  if (!track) return false;
  return (
    track.source === "youtube" ||
    track.source === "youtube-preview" ||
    Boolean(getYoutubeVideoId(track.sourceUrl || track.audioUrl))
  );
}

function getTrackSourceLabel(
  track?: Pick<ApiTrack, "source" | "audioUrl" | "sourceUrl"> | null,
) {
  if (!track) return "Nhạc";
  if (isYoutubeTrack(track)) return "YouTube";
  if (track.source === "mp3") return "MP3";
  return "Nhạc cá nhân";
}

function getYoutubeResultKey(track: YoutubeTrackInfo) {
  return track.sourceUrl || track.audioUrl || track.id || track.title;
}

function mergeYoutubeResults(
  current: YoutubeTrackInfo[],
  incoming: YoutubeTrackInfo[],
) {
  const seen = new Set(current.map(getYoutubeResultKey));
  const next = [...current];

  for (const track of incoming) {
    const key = getYoutubeResultKey(track);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(track);
  }

  return next;
}

export function MusicPlayer({
  playlist,
  onAddTrack,
  onRemoveTrack,
  onResolveYoutubeUrl,
  onSearchYoutube,
}: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadingMoreYoutubeRef = useRef(false);
  const youtubeSearchQueryRef = useRef("");
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [showList, setShowList] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showYoutubeFrame, setShowYoutubeFrame] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [loadingMoreYoutube, setLoadingMoreYoutube] = useState(false);
  const [removingTrackId, setRemovingTrackId] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeResults, setYoutubeResults] = useState<YoutubeTrackInfo[]>([]);
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState("");
  const [youtubeHasMore, setYoutubeHasMore] = useState(false);
  const [youtubePreview, setYoutubePreview] = useState<YoutubeTrackInfo | null>(
    null,
  );
  const [addError, setAddError] = useState("");

  const tracks = playlist?.tracks ?? [];
  const track = tracks[current];
  const previewTrack = useMemo<ApiTrack | null>(() => {
    if (!youtubePreview) return null;
    return {
      id: `youtube-preview-${youtubePreview.sourceUrl}`,
      title: youtubePreview.title,
      artist: youtubePreview.artist,
      audioUrl: youtubePreview.sourceUrl,
      coverUrl: youtubePreview.coverUrl,
      duration: youtubePreview.duration,
      source: "youtube",
      sourceUrl: youtubePreview.sourceUrl,
    };
  }, [youtubePreview]);
  const activeTrack = previewTrack ?? track;
  const isPreviewing = Boolean(previewTrack);
  const activeIsYoutube = isYoutubeTrack(activeTrack);
  const activeYoutubeEmbedUrl = activeIsYoutube
    ? getYoutubeEmbedUrl(
        activeTrack?.sourceUrl || activeTrack?.audioUrl || "",
        playing,
      )
    : "";
  const canUseTransport = Boolean(activeTrack);
  const progressDisabled = !canUseTransport || activeIsYoutube || duration <= 0;
  const queueCurrentTrack = isPreviewing ? activeTrack : track;
  const upcomingTracks = useMemo(() => {
    const indexedTracks = tracks.map((item, index) => ({ item, index }));
    if (isPreviewing) return indexedTracks;
    if (tracks.length <= 1) return [];

    return [
      ...indexedTracks.slice(current + 1),
      ...indexedTracks.slice(0, current),
    ];
  }, [current, isPreviewing, tracks]);

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
    setDuration(activeIsYoutube ? 0 : (activeTrack?.duration ?? 0));
  }, [activeTrack?.id, activeTrack?.duration, activeIsYoutube]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (activeIsYoutube || !activeTrack) {
      a.pause();
      a.currentTime = 0;
      setProgress(0);
      return;
    }
  }, [activeIsYoutube, activeTrack]);

  useEffect(() => {
    if (activeIsYoutube) setShowYoutubeFrame(true);
  }, [activeIsYoutube, activeTrack?.id]);

  useEffect(() => {
    youtubeSearchQueryRef.current = youtubeSearchQuery;
  }, [youtubeSearchQuery]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !activeTrack || activeIsYoutube) return;
    if (playing) {
      void a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }, [playing, activeTrack, activeIsYoutube]);

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
          source: "mp3",
        });
      }

      setYoutubePreview(null);
      setYoutubeResults([]);
      setYoutubeSearchQuery("");
      setYoutubeHasMore(false);
      setYoutubeUrl("");
      setShowAdd(false);
    } catch (error) {
      setAddError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function selectYoutubeTrack(trackInfo: YoutubeTrackInfo) {
    const sourceUrl = getYoutubeWatchUrl(
      trackInfo.sourceUrl || trackInfo.audioUrl,
    );
    setYoutubePreview({
      ...trackInfo,
      audioUrl: sourceUrl,
      coverUrl: trackInfo.coverUrl || getYoutubeCoverUrl(sourceUrl),
      source: "youtube",
      sourceUrl,
    });
    setShowList(false);
    setShowYoutubeFrame(true);
    setPlaying(true);
  }

  async function handleResolveYoutube(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = youtubeUrl.trim();
    if (!query) return;

    setResolving(true);
    setAddError("");
    setYoutubeResults([]);
    setYoutubeSearchQuery("");
    setYoutubeHasMore(false);
    try {
      if (getYoutubeVideoId(query)) {
        const trackInfo = await onResolveYoutubeUrl(query);
        selectYoutubeTrack(trackInfo);
        return;
      }

      const result = await onSearchYoutube(query, {
        limit: YOUTUBE_SEARCH_PAGE_SIZE,
        offset: 0,
      });
      setYoutubeSearchQuery(query);
      setYoutubeResults(result.tracks);
      setYoutubeHasMore(result.hasMore);
      if (result.tracks.length === 0) {
        setAddError("Không tìm thấy video phù hợp.");
      }
    } catch (error) {
      const videoId = getYoutubeVideoId(query);
      if (videoId) {
        const sourceUrl = getYoutubeWatchUrl(query);
        selectYoutubeTrack({
          id: videoId,
          title: "Video YouTube",
          artist: "YouTube",
          audioUrl: sourceUrl,
          coverUrl: getYoutubeCoverUrl(sourceUrl),
          source: "youtube",
          sourceUrl,
        });
      } else {
        setAddError(getErrorMessage(error));
      }
    } finally {
      setResolving(false);
    }
  }

  async function loadMoreYoutubeResults() {
    const query = youtubeSearchQuery.trim();
    if (
      !query ||
      !youtubeHasMore ||
      resolving ||
      loadingMoreYoutube ||
      loadingMoreYoutubeRef.current
    ) {
      return;
    }

    loadingMoreYoutubeRef.current = true;
    setLoadingMoreYoutube(true);
    setAddError("");
    try {
      const result = await onSearchYoutube(query, {
        limit: YOUTUBE_SEARCH_PAGE_SIZE,
        offset: youtubeResults.length,
      });
      if (youtubeSearchQueryRef.current !== query) return;
      setYoutubeResults((current) =>
        mergeYoutubeResults(current, result.tracks),
      );
      setYoutubeHasMore(result.hasMore);
    } catch (error) {
      setYoutubeHasMore(false);
      setAddError(getErrorMessage(error));
    } finally {
      loadingMoreYoutubeRef.current = false;
      setLoadingMoreYoutube(false);
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
        audioUrl: youtubePreview.sourceUrl,
        coverUrl: youtubePreview.coverUrl,
        duration: youtubePreview.duration,
        source: "youtube",
        sourceUrl: youtubePreview.sourceUrl,
      });
      setYoutubePreview(null);
      setYoutubeResults([]);
      setYoutubeSearchQuery("");
      setYoutubeHasMore(false);
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
        src={activeIsYoutube ? undefined : activeTrack?.audioUrl}
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
                ? activeIsYoutube
                  ? "Video YouTube"
                  : isPreviewing
                    ? `${activeTrack.artist} · nghe thử`
                    : `MP3 · ${activeTrack.artist}`
                : "Thêm nhạc để bắt đầu"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={!canUseTransport}
              className="rounded-full p-2 text-[#a3937a] transition hover:bg-white/[0.06] hover:text-[#ecdfc5]"
              aria-label="Bài trước"
            >
              <SkipBack className="size-4" />
            </button>
            <button
              onClick={() => setPlaying((value) => !value)}
              disabled={!canUseTransport}
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
              disabled={!canUseTransport}
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
              {activeIsYoutube ? "YT" : formatTime(progress)}
            </span>
            <ProgressSlider
              min={0}
              max={duration || 0}
              value={progress}
              step={1}
              disabled={progressDisabled}
              onChange={(value) => {
                const audio = audioRef.current;
                if (audio) audio.currentTime = value;
                setProgress(value);
              }}
              className="flex-1"
              ariaLabel="Tua bài hát"
              valueLabel={
                activeIsYoutube
                  ? "YouTube player"
                  : `${formatTime(progress)} / ${formatTime(duration)}`
              }
            />
            <span className="w-9 shrink-0 text-[10px] tabular-nums text-[#8a744f]">
              {activeIsYoutube ? "--" : formatTime(duration)}
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
          {activeIsYoutube && activeYoutubeEmbedUrl && (
            <button
              onClick={() => setShowYoutubeFrame((value) => !value)}
              className={cn(
                "rounded-full p-2 transition hover:bg-white/[0.06]",
                showYoutubeFrame
                  ? "text-[#d9b98a]"
                  : "text-[#a3937a] hover:text-[#ecdfc5]",
              )}
              aria-label={showYoutubeFrame ? "Ẩn YouTube" : "Hiện YouTube"}
              aria-pressed={showYoutubeFrame}
            >
              {showYoutubeFrame ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          )}
          <button
            onClick={() => {
              setShowList((value) => !value);
              setShowAdd(false);
            }}
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

      {activeYoutubeEmbedUrl && playing && (
        <div
          className={cn(
            "absolute bottom-full left-6 z-20 mb-3 w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/[0.10] bg-[#1d160d]/95 shadow-2xl backdrop-blur-xl transition duration-200",
            showYoutubeFrame
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0",
          )}
        >
          <iframe
            key={activeYoutubeEmbedUrl}
            src={activeYoutubeEmbedUrl}
            title={activeTrack?.title ?? "YouTube"}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

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
                setYoutubeResults([]);
                setYoutubeSearchQuery("");
                setYoutubeHasMore(false);
                setAddError("");
              }}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              placeholder="Tìm hoặc dán URL YouTube..."
            />
            <button
              type="submit"
              disabled={resolving || !youtubeUrl.trim()}
              className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#d9b98a] px-3 text-xs font-semibold text-[#241b10] transition hover:brightness-110 disabled:opacity-40"
            >
              {resolving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {resolving ? "Đang tìm" : "Tìm"}
            </button>
          </div>

          {youtubeResults.length > 0 && (
            <div
              onScroll={(event) => {
                const target = event.currentTarget;
                const distanceFromBottom =
                  target.scrollHeight - target.scrollTop - target.clientHeight;
                if (distanceFromBottom < 80) void loadMoreYoutubeResults();
              }}
              className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[#3a2d1a] bg-black/[0.22] p-2 lumi-scroll"
            >
              {youtubeResults.map((item) => (
                <button
                  key={item.sourceUrl || item.id || item.title}
                  type="button"
                  onClick={() => selectYoutubeTrack(item)}
                  className="group flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/[0.08]"
                >
                  <span className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md border border-white/[0.10] bg-black/30">
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold text-[#f0e6d2]">
                      {item.title}
                    </span>
                    <span className="mt-1 block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a8895c]">
                      {item.artist || "YouTube"}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-lg border border-[#d9b98a]/30 px-2 py-1 text-[10px] font-semibold text-[#d9b98a] opacity-75 transition group-hover:opacity-100">
                    Chọn
                  </span>
                </button>
              ))}
              {(youtubeHasMore || loadingMoreYoutube) && (
                <div className="flex h-10 items-center justify-center text-[#d9b98a]/80">
                  {loadingMoreYoutube ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span className="h-px w-10 rounded-full bg-[#d9b98a]/30" />
                  )}
                </div>
              )}
            </div>
          )}

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
                  Video YouTube · {youtubePreview.artist}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSaveYoutube()}
                disabled={saving || resolving}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#d9b98a]/40 bg-[#d9b98a]/[0.12] px-4 text-xs font-semibold text-[#e9d2a6] transition hover:bg-[#d9b98a]/[0.20] disabled:opacity-45"
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Lưu link YouTube
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
        <div className="absolute bottom-full right-6 z-30 mb-3 flex max-h-[min(78vh,720px)] w-[min(368px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#3a2d1a] bg-[#1d160d]/[0.98] text-[#ecdfc5] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
            <div className="min-w-0 pr-3">
              <p className="font-heading text-base font-semibold text-[#f5ead7]">
                Danh sách phát
              </p>
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a8895c]">
                {tracks.length} bài trong {playlist?.name ?? "Nhạc yêu thích"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowList(false)}
              className="grid size-9 place-items-center rounded-full text-[#a3937a] transition hover:bg-white/[0.06] hover:text-[#ecdfc5]"
              aria-label="Đóng danh sách phát"
            >
              <X className="size-4" />
            </button>
          </div>

          {tracks.length === 0 && !queueCurrentTrack ? (
            <div className="grid min-h-52 place-items-center px-6 py-10 text-center">
              <div>
                <div className="mx-auto grid size-12 place-items-center rounded-full border border-[#3a2d1a] bg-black/20 text-[#d9b98a]">
                  <ListMusic className="size-5" />
                </div>
                <p className="mt-4 text-sm font-semibold text-[#f0e6d2]">
                  Danh sách trống
                </p>
                <p className="mt-1 text-xs text-[#a3937a]">
                  Thêm nhạc để bắt đầu nghe.
                </p>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 lumi-scroll">
              {queueCurrentTrack && (
                <section>
                  <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#d9b98a]">
                    Đang phát
                  </p>
                  <div className="group flex items-center gap-3 rounded-xl bg-[#2b2115] p-2 shadow-[inset_0_1px_0_rgba(236,223,197,0.05)]">
                    <button
                      type="button"
                      onClick={() => {
                        if (isPreviewing) setPlaying(true);
                        else playIndex(current);
                      }}
                      className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-black/30"
                      aria-label={`Phát ${queueCurrentTrack.title}`}
                    >
                      {queueCurrentTrack.coverUrl ? (
                        <img
                          src={queueCurrentTrack.coverUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center text-[#d9b98a]">
                          <ListMusic className="size-5" />
                        </span>
                      )}
                      <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                        {playing ? (
                          <span className="flex h-4 items-end justify-center gap-[3px]">
                            <span
                              className="w-[3px] rounded-full bg-[#d9b98a]"
                              style={{
                                animation: "lumi-eq 0.8s ease-in-out infinite",
                              }}
                            />
                            <span
                              className="w-[3px] rounded-full bg-[#d9b98a]"
                              style={{
                                animation:
                                  "lumi-eq 0.8s ease-in-out 0.2s infinite",
                              }}
                            />
                            <span
                              className="w-[3px] rounded-full bg-[#d9b98a]"
                              style={{
                                animation:
                                  "lumi-eq 0.8s ease-in-out 0.4s infinite",
                              }}
                            />
                          </span>
                        ) : (
                          <Play className="ml-0.5 size-5 fill-current" />
                        )}
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#f5ead7]">
                        {queueCurrentTrack.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-[#b8a688]">
                        {queueCurrentTrack.artist}
                      </p>
                      <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a8895c]">
                        {isPreviewing
                          ? "Đang nghe thử"
                          : getTrackSourceLabel(queueCurrentTrack)}
                      </p>
                    </div>

                    {!isPreviewing && track && (
                      <button
                        type="button"
                        onClick={() => void removeTrack(track.id)}
                        className="grid size-9 shrink-0 place-items-center rounded-full text-[#a3937a] opacity-70 transition hover:bg-red-400/10 hover:text-red-200 group-hover:opacity-100"
                        aria-label={`Xóa ${track.title}`}
                        disabled={removingTrackId === track.id}
                      >
                        {removingTrackId === track.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </button>
                    )}
                  </div>
                </section>
              )}

              <section className="mt-5">
                <p className="px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#f0e6d2]">
                  Tiếp theo
                </p>
                <p className="mt-1 truncate px-1 text-xs text-[#a3937a]">
                  {queueCurrentTrack
                    ? `Sau ${queueCurrentTrack.title}`
                    : (playlist?.name ?? "Nhạc yêu thích")}
                </p>

                <div className="mt-3 space-y-1.5">
                  {upcomingTracks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#3a2d1a] px-3 py-4 text-center text-xs text-[#a3937a]">
                      Hết danh sách phát.
                    </p>
                  ) : (
                    upcomingTracks.map(({ item, index }) => (
                      <div
                        key={item.id}
                        className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.06]"
                      >
                        <button
                          type="button"
                          onClick={() => playIndex(index)}
                          className="relative size-12 shrink-0 overflow-hidden rounded-md border border-white/[0.08] bg-black/25 text-[#d9b98a]"
                          aria-label={`Phát ${item.title}`}
                        >
                          {item.coverUrl ? (
                            <img
                              src={item.coverUrl}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <span className="absolute inset-0 grid place-items-center">
                              <ListMusic className="size-4" />
                            </span>
                          )}
                          <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                            <Play className="ml-0.5 size-4 fill-current" />
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => playIndex(index)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-sm font-semibold text-[#f0e6d2]">
                            {item.title}
                          </span>
                          <span className="mt-1 block truncate text-xs text-[#a3937a]">
                            {item.artist}
                          </span>
                          <span className="mt-1 block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a8895c]">
                            {getTrackSourceLabel(item)}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void removeTrack(item.id)}
                          className="grid size-8 shrink-0 place-items-center rounded-full text-[#7f6f58] opacity-0 transition hover:bg-red-400/10 hover:text-red-200 group-hover:opacity-100"
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
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          <div className="flex h-12 shrink-0 items-center justify-between border-t border-white/[0.07] px-4 text-[11px] text-[#a3937a]">
            <span className="rounded-md bg-[#d9b98a]/15 px-2 py-1 font-semibold text-[#e9d2a6]">
              {activeIsYoutube ? "YouTube" : "MP3"}
            </span>
            <ListMusic className="size-4" />
          </div>
        </div>
      )}
    </div>
  );
}

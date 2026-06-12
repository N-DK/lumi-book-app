const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const youtubeDl = require("youtube-dl-exec");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

const SEARCH_DEFAULT_LIMIT = 5;
const SEARCH_MAX_LIMIT = 20;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 40;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);
const searchCache = new Map();

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function getSearchKey(searchTerm) {
  return searchTerm.toLowerCase().replace(/\s+/g, " ");
}

function pruneSearchCache() {
  const now = Date.now();
  for (const [key, entry] of searchCache.entries()) {
    if (entry.expiresAt <= now) searchCache.delete(key);
  }

  while (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (!oldestKey) break;
    searchCache.delete(oldestKey);
  }
}

function getCachedSearchEntry(searchTerm) {
  pruneSearchCache();

  const key = getSearchKey(searchTerm);
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const entry = {
    exhausted: false,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    fetchedLimit: 0,
    promise: null,
    searchTerm,
    tracks: [],
  };
  searchCache.set(key, entry);
  return entry;
}

function normalizeYoutubeUrl(value) {
  if (!value || typeof value !== "string") {
    const error = new Error("Thiếu URL YouTube.");
    error.statusCode = 400;
    throw error;
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    const error = new Error("URL YouTube không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    const error = new Error("URL YouTube không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  if (!YOUTUBE_HOSTS.has(parsed.hostname)) {
    const error = new Error("Hiện chỉ hỗ trợ link YouTube.");
    error.statusCode = 400;
    throw error;
  }

  return parsed.toString();
}

function getFfmpegDirectory() {
  return path.dirname(ffmpegInstaller.path);
}

function getTrackArtist(info) {
  return (
    info.artist ||
    info.creator ||
    info.uploader ||
    info.channel ||
    "YouTube"
  );
}

function getBestThumbnail(info) {
  if (Array.isArray(info.thumbnails) && info.thumbnails.length > 0) {
    const sorted = [...info.thumbnails].sort(
      (a, b) => (b.width ?? 0) - (a.width ?? 0),
    );
    return sorted.find((item) => item.url)?.url ?? info.thumbnail ?? "";
  }

  return info.thumbnail ?? "";
}

function getYoutubeSourceUrl(info) {
  if (info.webpage_url) return info.webpage_url;
  if (info.original_url) return info.original_url;
  if (info.id) return `https://www.youtube.com/watch?v=${info.id}`;
  return "";
}

function toYoutubeTrack(info) {
  const sourceUrl = getYoutubeSourceUrl(info);

  return {
    id: info.id,
    title: info.title || "YouTube video",
    artist: getTrackArtist(info),
    duration: Number(info.duration) || 0,
    coverUrl: getBestThumbnail(info),
    audioUrl: sourceUrl,
    sourceUrl,
    source: "youtube",
  };
}

function dedupeYoutubeTracks(tracks) {
  const seen = new Set();
  const unique = [];

  for (const track of tracks) {
    const key = track.sourceUrl || track.id || track.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(track);
  }

  return unique;
}

async function getYoutubeInfo(sourceUrl) {
  const normalizedUrl = normalizeYoutubeUrl(sourceUrl);
  const info = await youtubeDl(normalizedUrl, {
    dumpSingleJson: true,
    noPlaylist: true,
    skipDownload: true,
    ffmpegLocation: getFfmpegDirectory(),
  });

  return {
    ...toYoutubeTrack(info),
    sourceUrl: normalizedUrl,
    audioUrl: normalizedUrl,
  };
}

async function runYoutubeSearch(searchTerm, limit) {
  const result = await youtubeDl(`ytsearch${limit}:${searchTerm}`, {
    dumpSingleJson: true,
    skipDownload: true,
    ignoreErrors: true,
    noWarnings: true,
    ffmpegLocation: getFfmpegDirectory(),
  });

  const entries = Array.isArray(result.entries) ? result.entries : [];
  return entries
    .filter((item) => item?.id || item?.webpage_url)
    .map(toYoutubeTrack)
    .filter((item) => item.sourceUrl);
}

async function ensureYoutubeSearch(entry, requiredCount) {
  while (entry.tracks.length < requiredCount && !entry.exhausted) {
    if (!entry.promise) {
      const fetchLimit = Math.min(
        Math.max(requiredCount, entry.fetchedLimit + SEARCH_DEFAULT_LIMIT),
        SEARCH_MAX_LIMIT,
      );
      if (fetchLimit <= entry.fetchedLimit) {
        entry.exhausted = true;
        break;
      }

      entry.promise = runYoutubeSearch(entry.searchTerm, fetchLimit)
        .then((tracks) => {
          entry.tracks = dedupeYoutubeTracks(tracks);
          entry.fetchedLimit = fetchLimit;
          entry.exhausted =
            tracks.length < fetchLimit || fetchLimit >= SEARCH_MAX_LIMIT;
          entry.expiresAt = Date.now() + SEARCH_CACHE_TTL_MS;
        })
        .finally(() => {
          entry.promise = null;
        });
    }

    await entry.promise;
  }
}

async function searchYoutubeVideos(query, options = {}) {
  const searchTerm = typeof query === "string" ? query.trim() : "";
  if (!searchTerm) {
    const error = new Error("Nhập từ khóa để tìm video YouTube.");
    error.statusCode = 400;
    throw error;
  }

  const hasOptions = options && typeof options === "object";
  const limit = hasOptions ? options.limit : options;
  const offset = hasOptions ? options.offset : 0;
  const safeLimit = clampNumber(limit, SEARCH_DEFAULT_LIMIT, 1, 5);
  const safeOffset = clampNumber(offset, 0, 0, SEARCH_MAX_LIMIT - 1);
  const requiredCount = Math.min(safeOffset + safeLimit, SEARCH_MAX_LIMIT);
  const entry = getCachedSearchEntry(searchTerm);

  await ensureYoutubeSearch(entry, requiredCount);

  const tracks = entry.tracks.slice(safeOffset, safeOffset + safeLimit);
  const nextOffset = safeOffset + tracks.length;
  const hasMore =
    entry.tracks.length > nextOffset ||
    (!entry.exhausted && nextOffset < SEARCH_MAX_LIMIT);

  return {
    tracks,
    offset: safeOffset,
    limit: safeLimit,
    hasMore,
  };
}

function getYoutubeAudioUrl(req, sourceUrl) {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/api/youtube/audio?url=${encodeURIComponent(sourceUrl)}`;
}

function removeTempFiles(prefix) {
  fs.readdir(os.tmpdir(), (readError, files = []) => {
    if (readError) return;

    for (const file of files) {
      if (file.startsWith(prefix)) {
        fs.unlink(path.join(os.tmpdir(), file), () => {});
      }
    }
  });
}

async function streamYoutubeMp3(sourceUrl, res) {
  const normalizedUrl = normalizeYoutubeUrl(sourceUrl);
  const tempPrefix = `lumi_yt_${Date.now()}_${randomUUID()}`;
  const tempBase = path.join(os.tmpdir(), tempPrefix);
  const outFile = `${tempBase}.mp3`;

  try {
    await youtubeDl(normalizedUrl, {
      noPlaylist: true,
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: "192",
      output: `${tempBase}.%(ext)s`,
      ffmpegLocation: getFfmpegDirectory(),
      addMetadata: true,
    });

    if (!fs.existsSync(outFile)) {
      const error = new Error("Không tạo được file MP3 từ YouTube.");
      error.statusCode = 500;
      throw error;
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Accept-Ranges", "none");

    const stream = fs.createReadStream(outFile);
    stream.pipe(res);
    stream.on("close", () => removeTempFiles(tempPrefix));
    stream.on("error", () => removeTempFiles(tempPrefix));
  } catch (error) {
    removeTempFiles(tempPrefix);
    throw error;
  }
}

module.exports = {
  getYoutubeAudioUrl,
  getYoutubeInfo,
  normalizeYoutubeUrl,
  searchYoutubeVideos,
  streamYoutubeMp3,
};

const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");

const SEARCH_DEFAULT_LIMIT = 5;
const SEARCH_MAX_LIMIT = 20;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 40;
const YOUTUBE_SEARCH_URL = "https://www.youtube.com/results";
const YOUTUBE_OEMBED_URL = "https://www.youtube.com/oembed";
const FETCH_HEADERS = {
  "accept-language": "vi,en-US;q=0.9,en;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

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

function getYoutubeVideoId(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    return parsed.pathname.split("/").filter(Boolean)[0] ?? "";
  }

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  ) {
    const watchId = parsed.searchParams.get("v");
    if (watchId) return watchId;

    const [kind, id] = parsed.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live"].includes(kind ?? "") && id) return id;
  }

  return "";
}

function getCanonicalYoutubeUrl(sourceUrl) {
  const videoId = getYoutubeVideoId(sourceUrl);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : sourceUrl;
}

function getFfmpegDirectory() {
  const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
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

function getText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.simpleText) return node.simpleText;
  if (Array.isArray(node.runs)) {
    return node.runs.map((run) => run.text ?? "").join("").trim();
  }
  return "";
}

function parseDuration(value) {
  if (!value || typeof value !== "string") return 0;
  const parts = value
    .split(":")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));

  if (parts.length === 0) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function getBestThumbnailFromList(thumbnails = []) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return "";
  return (
    [...thumbnails]
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
      .find((item) => item.url)?.url ?? ""
  );
}

function toYoutubeTrackFromRenderer(renderer) {
  const videoId = renderer.videoId;
  const sourceUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";

  return {
    id: videoId,
    title: getText(renderer.title) || "YouTube video",
    artist:
      getText(renderer.ownerText) ||
      getText(renderer.longBylineText) ||
      getText(renderer.shortBylineText) ||
      "YouTube",
    duration: parseDuration(getText(renderer.lengthText)),
    coverUrl: getBestThumbnailFromList(renderer.thumbnail?.thumbnails),
    audioUrl: sourceUrl,
    sourceUrl,
    source: "youtube",
  };
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

function findJsonObjectAfter(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;

  const start = html.indexOf("{", markerIndex);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start, index + 1);
      }
    }
  }

  return null;
}

function extractInitialData(html) {
  const json =
    findJsonObjectAfter(html, "var ytInitialData =") ??
    findJsonObjectAfter(html, "window[\"ytInitialData\"] =") ??
    findJsonObjectAfter(html, "ytInitialData =");

  if (!json) {
    const error = new Error("Không đọc được kết quả tìm kiếm YouTube.");
    error.statusCode = 502;
    throw error;
  }

  return JSON.parse(json);
}

function collectVideoRenderers(root) {
  const renderers = [];
  const stack = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    if (node.videoRenderer?.videoId) {
      renderers.push(node.videoRenderer);
      continue;
    }

    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") stack.push(value);
    }
  }

  return renderers;
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
  const canonicalUrl = getCanonicalYoutubeUrl(normalizedUrl);
  const params = new URLSearchParams({
    format: "json",
    url: canonicalUrl,
  });

  const response = await fetch(`${YOUTUBE_OEMBED_URL}?${params}`, {
    headers: FETCH_HEADERS,
  });

  if (!response.ok) {
    const error = new Error("Không lấy được thông tin video YouTube.");
    error.statusCode = response.status === 404 ? 404 : 502;
    throw error;
  }

  const info = await response.json();
  const videoId = getYoutubeVideoId(canonicalUrl);

  return {
    id: videoId,
    title: info.title || "YouTube video",
    artist: info.author_name || "YouTube",
    duration: 0,
    coverUrl:
      info.thumbnail_url ||
      (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ""),
    audioUrl: canonicalUrl,
    sourceUrl: canonicalUrl,
    source: "youtube",
  };
}

async function runYoutubeSearch(searchTerm, limit) {
  const params = new URLSearchParams({
    search_query: searchTerm,
    hl: "vi",
  });
  const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params}`, {
    headers: FETCH_HEADERS,
  });

  if (!response.ok) {
    const error = new Error("Không tìm kiếm được video YouTube.");
    error.statusCode = 502;
    throw error;
  }

  const html = await response.text();
  const initialData = extractInitialData(html);
  return collectVideoRenderers(initialData)
    .slice(0, limit)
    .map(toYoutubeTrackFromRenderer)
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
  if (process.env.VERCEL) {
    const error = new Error(
      "Vercel không hỗ trợ chuyển YouTube thành MP3. Hãy phát bằng YouTube iframe.",
    );
    error.statusCode = 501;
    throw error;
  }

  const youtubeDl = require("youtube-dl-exec");
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

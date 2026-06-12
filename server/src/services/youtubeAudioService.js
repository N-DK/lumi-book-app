const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const youtubeDl = require("youtube-dl-exec");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

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

async function getYoutubeInfo(sourceUrl) {
  const normalizedUrl = normalizeYoutubeUrl(sourceUrl);
  const info = await youtubeDl(normalizedUrl, {
    dumpSingleJson: true,
    noPlaylist: true,
    skipDownload: true,
    ffmpegLocation: getFfmpegDirectory(),
  });

  return {
    id: info.id,
    title: info.title || "YouTube audio",
    artist: getTrackArtist(info),
    duration: Number(info.duration) || 0,
    coverUrl: getBestThumbnail(info),
    sourceUrl: normalizedUrl,
    source: "youtube",
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
  streamYoutubeMp3,
};

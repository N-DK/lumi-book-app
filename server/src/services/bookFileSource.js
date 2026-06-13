const { Readable } = require("stream");

function trimSlashes(value) {
  return String(value ?? "").replace(/^\/+|\/+$/g, "");
}

function joinUrl(baseUrl, ...parts) {
  const cleanBase = String(baseUrl ?? "").replace(/\/+$/g, "");
  const cleanParts = parts.map(trimSlashes).filter(Boolean);
  return [cleanBase, ...cleanParts].join("/");
}

function getFileReferer(book, fileUrl) {
  if (book.sourceUrl) return book.sourceUrl;

  try {
    const url = new URL(fileUrl);
    return `${url.protocol}//${url.hostname}/`;
  } catch {
    return "";
  }
}

function getBookFileRequestHeaders(book, fileUrl) {
  const referer = getFileReferer(book, fileUrl);

  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    Accept:
      "application/epub+zip,application/pdf,application/octet-stream,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    ...(referer ? { Referer: referer } : {}),
  };
}

function getBookFileContentType(format, upstream) {
  return (
    upstream.headers.get("content-type") ||
    (format === "pdf" ? "application/pdf" : "application/epub+zip")
  );
}

function getStoredFileUrl(book, format) {
  const stored = book.storedFiles?.[format];
  if (stored?.url) return stored.url;

  const baseUrl = process.env.BOOK_FILE_BASE_URL;
  if (!baseUrl || !book.slug) return "";

  const key = stored?.key || `${book.slug}.${format}`;
  return joinUrl(baseUrl, key);
}

function getBookFileCandidates(book, format, originalUrl) {
  const candidates = [];
  const storageUrl = getStoredFileUrl(book, format);

  if (storageUrl) {
    candidates.push({ kind: "storage", url: storageUrl });
  }

  if (originalUrl && originalUrl !== storageUrl) {
    candidates.push({ kind: "source", url: originalUrl });
  }

  return candidates;
}

async function fetchBookFile(book, candidate, timeoutMs = 25000) {
  return fetch(candidate.url, {
    headers: getBookFileRequestHeaders(book, candidate.url),
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function streamFromWebBody(body) {
  return Readable.fromWeb(body);
}

module.exports = {
  fetchBookFile,
  getBookFileCandidates,
  getBookFileContentType,
  streamFromWebBody,
};

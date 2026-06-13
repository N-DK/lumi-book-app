const Bookmark = require("../models/Bookmark");
const Book = require("../models/Book");
const Category = require("../models/Category");
const ReadingProgress = require("../models/ReadingProgress");
const {
  fetchBookFile,
  getBookFileCandidates,
  getBookFileContentType,
  streamFromWebBody,
} = require("../services/bookFileSource");
const asyncHandler = require("../utils/asyncHandler");

const SPINES = [
  "oklch(0.45 0.12 45)",
  "oklch(0.4 0.08 280)",
  "oklch(0.42 0.09 200)",
  "oklch(0.5 0.1 140)",
  "oklch(0.4 0.07 25)",
  "oklch(0.38 0.06 260)",
];

const BOOK_FILE_RETRY_DELAYS = [800, 1800];

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeCategories(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }

  return [
    ...new Set(
      String(value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTextSearch(value) {
  return value.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
}

function buildRegexSearchFilter(searchText) {
  const regex = new RegExp(escapeRegex(searchText), "i");
  return {
    $or: [
      { title: regex },
      { author: regex },
      { description: regex },
      { category: regex },
      { categories: regex },
    ],
  };
}

function isCloudflareChallenge(detail) {
  return /just a moment|checking your browser|cloudflare|cf-browser|cf-chl/i.test(
    detail ?? "",
  );
}

function isRetryableBookFileFailure(status, detail) {
  if (isCloudflareChallenge(detail)) return false;
  return status === 0 || [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function isInvalidBookFileContentType(format, contentType) {
  const normalized = String(contentType ?? "").toLowerCase();
  if (!normalized) return false;

  if (
    normalized.includes("text/html") ||
    normalized.includes("text/plain") ||
    normalized.includes("application/json")
  ) {
    return true;
  }

  if (format === "epub") {
    return (
      !normalized.includes("application/epub+zip") &&
      !normalized.includes("application/octet-stream") &&
      !normalized.includes("application/zip")
    );
  }

  if (format === "pdf") {
    return (
      !normalized.includes("application/pdf") &&
      !normalized.includes("application/octet-stream")
    );
  }

  return false;
}

function buildBookFileFailure(candidate, status, detail) {
  const cleanDetail = String(detail ?? "").replace(/\s+/g, " ").trim();
  const cloudflareChallenge = isCloudflareChallenge(cleanDetail);

  return {
    code: cloudflareChallenge ? "cloudflare_challenge" : "book_file_unavailable",
    source: candidate.kind,
    status,
    detail: cleanDetail.slice(0, 180),
    retryable: isRetryableBookFileFailure(status, cleanDetail),
  };
}

function pipeBookFileResponse(upstream, res) {
  const stream = streamFromWebBody(upstream.body);

  stream.on("error", (error) => {
    console.error("Book file stream failed", error);

    if (res.headersSent) {
      res.destroy(error);
      return;
    }

    res.removeHeader("Content-Disposition");
    res.removeHeader("Content-Length");
    res.removeHeader("Content-Type");
    res.status(502).json({
      code: "book_file_stream_error",
      message: "File sách tải quá lâu hoặc kết nối nguồn bị ngắt. Vui lòng thử lại sau.",
      retryable: true,
      detail: error instanceof Error ? error.message : "Unknown stream error",
    });
  });

  stream.pipe(res);
}

async function fetchBookFileWithRetry(book, candidate) {
  let lastFailure = null;

  for (let attempt = 0; attempt <= BOOK_FILE_RETRY_DELAYS.length; attempt += 1) {
    try {
      const upstream = await fetchBookFile(book, candidate);

      if (upstream.ok && upstream.body) {
        return { upstream, failure: null };
      }

      const upstreamText = await upstream.text().catch(() => "");
      lastFailure = buildBookFileFailure(
        candidate,
        upstream.status,
        upstreamText,
      );
    } catch (error) {
      lastFailure = buildBookFileFailure(
        candidate,
        0,
        error instanceof Error ? error.message : "Unknown fetch error",
      );
    }

    if (
      !lastFailure.retryable ||
      attempt >= BOOK_FILE_RETRY_DELAYS.length
    ) {
      break;
    }

    await wait(BOOK_FILE_RETRY_DELAYS[attempt]);
  }

  return { upstream: null, failure: lastFailure };
}

function buildBookPayload(body, seedIndex = 0) {
  const categories = normalizeCategories(body.categories ?? body.category);
  const kind = body.kind || (body.epubUrl || body.epub_url ? "epub" : "pdf");
  const slug =
    body.slug ||
    slugify(body.title) ||
    `book-${Date.now().toString(36)}-${seedIndex}`;

  return {
    title: body.title,
    slug,
    author: body.author || "Không rõ",
    description: body.description || "",
    category: body.category || categories[0] || "",
    categories,
    published: body.published ? new Date(body.published) : undefined,
    coverUrl: body.coverUrl ?? body.cover_url ?? "",
    sourceUrl: body.sourceUrl ?? body.url ?? "",
    pdfUrl: body.pdfUrl ?? body.pdf_url ?? "",
    epubUrl: body.epubUrl ?? body.epub_url ?? "",
    epubSource: body.epubSource ?? body.epub_source ?? "",
    kind,
    spine: body.spine || SPINES[seedIndex % SPINES.length],
    chapters: body.chapters || [],
  };
}

async function attachUserBookState(userId, books) {
  if (!userId || books.length === 0) {
    return books.map((book) => book.toJSON());
  }

  const bookIds = books.map((book) => book._id);
  const [bookmarks, progress] = await Promise.all([
    Bookmark.find({ user: userId, book: { $in: bookIds } }),
    ReadingProgress.find({ user: userId, book: { $in: bookIds } }),
  ]);
  const saved = new Set(bookmarks.map((item) => item.book.toString()));
  const progressByBook = new Map(
    progress.map((item) => [item.book.toString(), item.toJSON()]),
  );

  return books.map((book) => ({
    ...book.toJSON(),
    saved: saved.has(book._id.toString()),
    progress: progressByBook.get(book._id.toString()) ?? null,
  }));
}

const listBooks = asyncHandler(async (req, res) => {
  const { search, category } = req.query;
  const page = Math.max(Number.parseInt(req.query.page ?? "1", 10) || 1, 1);
  const requestedLimit = Number.parseInt(req.query.limit ?? "", 10);
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 60)
      : 0;
  const searchText = typeof search === "string" ? search.trim() : "";
  const textSearch = normalizeTextSearch(searchText);
  const baseFilter = {};

  if (typeof category === "string" && category.trim() && category !== "all") {
    baseFilter.categories = category.trim();
  }

  const filter = { ...baseFilter };
  if (textSearch) {
    filter.$text = {
      $search: textSearch,
      $caseSensitive: false,
      $diacriticSensitive: false,
    };
  } else if (searchText) {
    Object.assign(filter, buildRegexSearchFilter(searchText));
  }

  const buildQuery = (queryFilter, useTextScore = false) => {
    const query = Book.find(queryFilter).sort(
      useTextScore
        ? { score: { $meta: "textScore" }, published: -1, createdAt: -1 }
        : { published: -1, createdAt: -1 },
    );

    if (limit > 0) {
      query.skip((page - 1) * limit).limit(limit);
    }

    return query;
  };

  let [books, total] = await Promise.all([
    buildQuery(filter, Boolean(textSearch)),
    Book.countDocuments(filter),
  ]);

  if (searchText && textSearch && total === 0) {
    const regexFilter = {
      ...baseFilter,
      ...buildRegexSearchFilter(searchText),
    };
    [books, total] = await Promise.all([
      buildQuery(regexFilter),
      Book.countDocuments(regexFilter),
    ]);
  }

  res.json({
    books: await attachUserBookState(req.user?._id, books),
    page,
    limit: limit || total,
    total,
    hasMore: limit > 0 ? page * limit < total : false,
  });
});

const getBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ message: "Không tìm thấy sách." });

  const progress = await ReadingProgress.findOne({
    user: req.user._id,
    book: book._id,
  });

  res.json({ book: { ...book.toJSON(), progress: progress ?? null } });
});

const createBook = asyncHandler(async (req, res) => {
  const payload = buildBookPayload(req.body);
  const existing = await Book.findOne({ slug: payload.slug });
  if (existing) {
    payload.slug = `${payload.slug}-${Date.now().toString(36)}`;
  }

  const book = await Book.create({
    ...payload,
    createdBy: req.user?._id,
  });
  res.status(201).json({ book });
});

const updateBook = asyncHandler(async (req, res) => {
  const book = await Book.findByIdAndUpdate(
    req.params.id,
    buildBookPayload(req.body),
    { returnDocument: "after", runValidators: true },
  );
  if (!book) return res.status(404).json({ message: "Không tìm thấy sách." });
  res.json({ book });
});

const deleteBook = asyncHandler(async (req, res) => {
  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) return res.status(404).json({ message: "Không tìm thấy sách." });
  res.json({ message: "Đã xóa sách." });
});

const listCategories = asyncHandler(async (_req, res) => {
  const categoryDocs = await Category.find({ active: true })
    .sort({ order: 1, name: 1 })
    .select("name -_id")
    .lean();
  const categories = categoryDocs.map((item) => item.name).filter(Boolean);

  if (categories.length > 0) {
    res.json({ categories });
    return;
  }

  const fallbackCategories = await Book.distinct("categories");
  res.json({
    categories: fallbackCategories
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "vi")),
  });
});

const downloadBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ message: "Không tìm thấy sách." });

  const requested = req.query.format === "pdf" ? "pdf" : "epub";
  const fileUrl = requested === "pdf" ? book.pdfUrl : book.epubUrl || book.pdfUrl;
  const format = requested === "pdf" || !book.epubUrl ? "pdf" : "epub";

  if (!fileUrl) {
    return res.status(404).json({ message: "Sách này chưa có file để đọc." });
  }

  const candidates = getBookFileCandidates(book, format, fileUrl);
  let lastFailure = null;

  for (const candidate of candidates) {
    const { upstream, failure } = await fetchBookFileWithRetry(book, candidate);
    if (!upstream) {
      lastFailure = failure;
      continue;
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (isInvalidBookFileContentType(format, contentType)) {
      const upstreamText = await upstream.text().catch(() => "");
      lastFailure = buildBookFileFailure(
        candidate,
        upstream.status,
        upstreamText || `Unexpected content type: ${contentType}`,
      );
      continue;
    }

    const contentLength = upstream.headers.get("content-length");

    res.setHeader("Content-Type", getBookFileContentType(format, upstream));
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${book.slug}.${format}"`,
    );

    pipeBookFileResponse(upstream, res);
    return;
  }

  const blockedByCloudflare = lastFailure?.code === "cloudflare_challenge";
  res.setHeader("Cache-Control", "no-store");
  res.status(502).json({
    code: lastFailure?.code ?? "book_file_unavailable",
    message: blockedByCloudflare
      ? "Nguồn sách đang bật lớp bảo vệ Cloudflare nên LUMI chưa lấy được file từ server. Bạn có thể thử lại sau hoặc chờ file được đồng bộ lên kho lưu trữ."
      : "Không tải được file sách lúc này. Vui lòng thử lại sau.",
    upstreamStatus: lastFailure?.status ?? 0,
    source: lastFailure?.source ?? "unknown",
    retryable: lastFailure?.retryable ?? true,
    detail: lastFailure?.detail ?? "",
  });
});

module.exports = {
  buildBookPayload,
  listBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  listCategories,
  downloadBook,
};

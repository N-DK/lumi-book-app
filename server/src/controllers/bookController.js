const { Readable } = require("stream");
const Bookmark = require("../models/Bookmark");
const Book = require("../models/Book");
const ReadingProgress = require("../models/ReadingProgress");
const asyncHandler = require("../utils/asyncHandler");

const SPINES = [
  "oklch(0.45 0.12 45)",
  "oklch(0.4 0.08 280)",
  "oklch(0.42 0.09 200)",
  "oklch(0.5 0.1 140)",
  "oklch(0.4 0.07 25)",
  "oklch(0.38 0.06 260)",
];

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
  const filter = {};

  if (typeof search === "string" && search.trim()) {
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: regex }, { author: regex }, { description: regex }];
  }

  if (typeof category === "string" && category.trim() && category !== "all") {
    filter.categories = category.trim();
  }

  const books = await Book.find(filter).sort({ published: -1, createdAt: -1 });
  res.json({ books: await attachUserBookState(req.user?._id, books) });
});

const getBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ message: "Không tìm thấy sách." });
  res.json({ book });
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
  const categories = await Book.distinct("categories");
  res.json({ categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b, "vi")) });
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

  const upstream = await fetch(fileUrl);
  if (!upstream.ok || !upstream.body) {
    return res.status(502).json({ message: "Không tải được file sách từ nguồn." });
  }

  res.setHeader("Content-Type", format === "pdf" ? "application/pdf" : "application/epub+zip");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${book.slug}.${format}"`,
  );

  Readable.fromWeb(upstream.body).pipe(res);
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

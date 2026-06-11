const Bookmark = require("../models/Bookmark");
const Book = require("../models/Book");
const ReadingProgress = require("../models/ReadingProgress");
const asyncHandler = require("../utils/asyncHandler");

async function attachProgress(userId, books) {
  const progress = await ReadingProgress.find({
    user: userId,
    book: { $in: books.map((book) => book._id) },
  });
  const byBook = new Map(progress.map((item) => [item.book.toString(), item]));

  return books.map((book) => ({
    ...book.toJSON(),
    progress: byBook.get(book._id.toString()) ?? null,
  }));
}

const listBookmarks = asyncHandler(async (req, res) => {
  const bookmarks = await Bookmark.find({ user: req.user._id })
    .populate("book")
    .sort({ createdAt: -1 });
  const books = bookmarks.map((bookmark) => bookmark.book).filter(Boolean);
  res.json({ books: await attachProgress(req.user._id, books) });
});

const createBookmark = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.body.bookId);
  if (!book) return res.status(404).json({ message: "Không tìm thấy sách." });

  await Bookmark.findOneAndUpdate(
    { user: req.user._id, book: book._id },
    { $setOnInsert: { user: req.user._id, book: book._id } },
    { upsert: true, returnDocument: "after" },
  );

  res.status(201).json({ book });
});

const deleteBookmark = asyncHandler(async (req, res) => {
  await Bookmark.findOneAndDelete({
    user: req.user._id,
    book: req.params.bookId,
  });

  res.json({ message: "Đã bỏ lưu sách." });
});

module.exports = {
  listBookmarks,
  createBookmark,
  deleteBookmark,
};

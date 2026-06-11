const ReadingProgress = require("../models/ReadingProgress");
const Book = require("../models/Book");
const asyncHandler = require("../utils/asyncHandler");

function computePercent(currentPage, totalPages) {
  if (!totalPages || totalPages <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((currentPage + 1) / totalPages) * 100)));
}

const listProgress = asyncHandler(async (req, res) => {
  const progress = await ReadingProgress.find({ user: req.user._id })
    .populate("book")
    .sort({ updatedAt: -1 });
  res.json({ progress });
});

const getProgress = asyncHandler(async (req, res) => {
  const progress = await ReadingProgress.findOne({
    user: req.user._id,
    book: req.params.bookId,
  }).populate("book");

  res.json({ progress });
});

const upsertProgress = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.bookId);
  if (!book) return res.status(404).json({ message: "Không tìm thấy sách." });

  const currentPage = Math.max(0, Math.floor(Number(req.body.currentPage) || 0));
  const totalPages = Math.max(0, Math.floor(Number(req.body.totalPages) || 0));
  const percent = computePercent(currentPage, totalPages);

  const progress = await ReadingProgress.findOneAndUpdate(
    { user: req.user._id, book: book._id },
    {
      $set: {
        currentPage,
        totalPages,
        currentChapter: req.body.currentChapter || "",
        currentCfi: req.body.currentCfi || "",
        percent,
        completed: totalPages > 0 && currentPage >= totalPages - 1,
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  ).populate("book");

  res.json({ progress });
});

const deleteProgress = asyncHandler(async (req, res) => {
  await ReadingProgress.findOneAndDelete({
    user: req.user._id,
    book: req.params.bookId,
  });
  res.json({ message: "Đã xóa tiến độ đọc." });
});

module.exports = {
  listProgress,
  getProgress,
  upsertProgress,
  deleteProgress,
};

const mongoose = require("mongoose");

const readingProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },
    currentPage: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPages: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentChapter: {
      type: String,
      default: "",
    },
    currentCfi: {
      type: String,
      default: "",
    },
    percent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

readingProgressSchema.index({ user: 1, book: 1 }, { unique: true });

readingProgressSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("ReadingProgress", readingProgressSchema);

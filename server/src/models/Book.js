const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    author: {
      type: String,
      default: "Không rõ",
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "",
      trim: true,
    },
    categories: {
      type: [String],
      default: [],
      index: true,
    },
    published: {
      type: Date,
    },
    coverUrl: {
      type: String,
      default: "",
    },
    sourceUrl: {
      type: String,
      default: "",
    },
    pdfUrl: {
      type: String,
      default: "",
    },
    epubUrl: {
      type: String,
      default: "",
    },
    epubSource: {
      type: String,
      default: "",
    },
    storedFiles: {
      epub: {
        url: {
          type: String,
          default: "",
        },
        key: {
          type: String,
          default: "",
        },
        sourceUrl: {
          type: String,
          default: "",
        },
        contentType: {
          type: String,
          default: "",
        },
        size: {
          type: Number,
          default: 0,
        },
        cachedAt: {
          type: Date,
        },
      },
      pdf: {
        url: {
          type: String,
          default: "",
        },
        key: {
          type: String,
          default: "",
        },
        sourceUrl: {
          type: String,
          default: "",
        },
        contentType: {
          type: String,
          default: "",
        },
        size: {
          type: Number,
          default: 0,
        },
        cachedAt: {
          type: Date,
        },
      },
    },
    kind: {
      type: String,
      enum: ["pdf", "epub", "sample"],
      default: "epub",
    },
    spine: {
      type: String,
      default: "oklch(0.4 0.08 280)",
    },
    chapters: {
      type: [
        {
          title: String,
          paragraphs: [String],
        },
      ],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

bookSchema.index({ title: "text", author: "text", description: "text" });

bookSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("Book", bookSchema);

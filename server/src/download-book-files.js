require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Book = require("./models/Book");
const { fetchBookFile, streamFromWebBody } = require("./services/bookFileSource");

function parseArgs(argv) {
  const args = {
    force: false,
    format: "epub",
    id: "",
    limit: 0,
    out: "book-files",
    slug: "",
  };

  for (const item of argv) {
    if (item === "--force") args.force = true;
    else if (item.startsWith("--format=")) args.format = item.slice("--format=".length);
    else if (item.startsWith("--id=")) args.id = item.slice("--id=".length);
    else if (item.startsWith("--limit=")) {
      args.limit = Math.max(Number.parseInt(item.slice("--limit=".length), 10) || 0, 0);
    } else if (item.startsWith("--out=")) args.out = item.slice("--out=".length);
    else if (item.startsWith("--slug=")) args.slug = item.slice("--slug=".length);
  }

  if (!["epub", "pdf"].includes(args.format)) {
    throw new Error("Invalid --format. Use epub or pdf.");
  }

  return args;
}

function getSourceUrl(book, format) {
  return format === "pdf" ? book.pdfUrl : book.epubUrl;
}

async function findBooks(args) {
  const filter = {};
  if (args.id) filter._id = args.id;
  if (args.slug) filter.slug = args.slug;
  if (!args.id && !args.slug) {
    filter[args.format === "pdf" ? "pdfUrl" : "epubUrl"] = { $nin: ["", null] };
  }

  const query = Book.find(filter);
  if (args.limit > 0) query.sort({ _id: -1 }).limit(args.limit);
  return query;
}

async function downloadBookFile(book, args) {
  const sourceUrl = getSourceUrl(book, args.format);
  if (!sourceUrl) return { skipped: true, reason: `missing ${args.format} url` };

  const outputDir = path.resolve(args.out);
  const outputPath = path.join(outputDir, `${book.slug}.${args.format}`);
  const tempPath = `${outputPath}.tmp`;

  await fs.promises.mkdir(outputDir, { recursive: true });

  if (!args.force && fs.existsSync(outputPath)) {
    return { skipped: true, reason: "already downloaded" };
  }

  const upstream = await fetchBookFile(book, { kind: "source", url: sourceUrl }, 90000);
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(
      `HTTP ${upstream.status}: ${detail.replace(/\s+/g, " ").trim().slice(0, 180)}`,
    );
  }

  await pipeline(streamFromWebBody(upstream.body), fs.createWriteStream(tempPath));
  await fs.promises.rename(tempPath, outputPath);

  return { skipped: false, outputPath };
}

async function downloadBookFiles() {
  const args = parseArgs(process.argv.slice(2));
  await connectDB();

  const books = await findBooks(args);
  if (books.length === 0) {
    console.log("No books matched.");
    return;
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const book of books) {
    try {
      const result = await downloadBookFile(book, args);
      if (result.skipped) {
        skipped += 1;
        console.log(`Skip ${book.slug}: ${result.reason}`);
      } else {
        downloaded += 1;
        console.log(`Downloaded ${book.slug} -> ${result.outputPath}`);
      }
    } catch (error) {
      failed += 1;
      console.error(
        `Failed ${book.slug}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  console.log(`Done. downloaded=${downloaded}, skipped=${skipped}, failed=${failed}`);
}

if (require.main === module) {
  downloadBookFiles()
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error("Cannot download book files", error);
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    });
}

module.exports = { downloadBookFiles };

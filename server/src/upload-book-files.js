require("dotenv").config();

const mongoose = require("mongoose");
const { put } = require("@vercel/blob");
const connectDB = require("./config/db");
const Book = require("./models/Book");
const { fetchBookFile, getBookFileContentType } = require("./services/bookFileSource");

function parseArgs(argv) {
  const args = {
    force: false,
    format: "epub",
    id: "",
    limit: 0,
    slug: "",
  };

  for (const item of argv) {
    if (item === "--force") args.force = true;
    else if (item.startsWith("--format=")) args.format = item.slice("--format=".length);
    else if (item.startsWith("--id=")) args.id = item.slice("--id=".length);
    else if (item.startsWith("--limit=")) {
      args.limit = Math.max(Number.parseInt(item.slice("--limit=".length), 10) || 0, 0);
    } else if (item.startsWith("--slug=")) args.slug = item.slice("--slug=".length);
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

async function uploadBookFile(book, args) {
  const sourceUrl = getSourceUrl(book, args.format);
  if (!sourceUrl) return { skipped: true, reason: `missing ${args.format} url` };

  if (!args.force && book.storedFiles?.[args.format]?.url) {
    return { skipped: true, reason: "already stored" };
  }

  // Tải file từ source. Chạy local (IP nhà mạng) nên không bị Cloudflare chặn
  // như khi fetch từ IP của Vercel.
  const upstream = await fetchBookFile(book, { kind: "source", url: sourceUrl }, 90000);
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(
      `HTTP ${upstream.status}: ${detail.replace(/\s+/g, " ").trim().slice(0, 180)}`,
    );
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  const contentType = getBookFileContentType(args.format, upstream);
  const key = `books/${book.slug}.${args.format}`;

  const blob = await put(key, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await Book.updateOne(
    { _id: book._id },
    {
      $set: {
        [`storedFiles.${args.format}`]: {
          url: blob.url,
          key,
          sourceUrl,
          contentType,
          size: buffer.length,
          cachedAt: new Date(),
        },
      },
    },
  );

  return { skipped: false, url: blob.url, size: buffer.length };
}

async function uploadBookFiles() {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Missing BLOB_READ_WRITE_TOKEN. Lấy token từ Vercel Blob store rồi đặt vào .env (hoặc chạy `vercel env pull`).",
    );
  }

  await connectDB();

  const books = await findBooks(args);
  if (books.length === 0) {
    console.log("No books matched.");
    return;
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const book of books) {
    try {
      const result = await uploadBookFile(book, args);
      if (result.skipped) {
        skipped += 1;
        console.log(`Skip ${book.slug}: ${result.reason}`);
      } else {
        uploaded += 1;
        console.log(
          `Uploaded ${book.slug} -> ${result.url} (${result.size} bytes)`,
        );
      }
    } catch (error) {
      failed += 1;
      console.error(
        `Failed ${book.slug}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  console.log(`Done. uploaded=${uploaded}, skipped=${skipped}, failed=${failed}`);
}

if (require.main === module) {
  uploadBookFiles()
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error("Cannot upload book files", error);
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    });
}

module.exports = { uploadBookFiles };

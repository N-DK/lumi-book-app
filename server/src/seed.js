require("dotenv").config();

const fs = require("fs");
const path = require("path");
const connectDB = require("./config/db");
const Book = require("./models/Book");
const Category = require("./models/Category");
const { buildBookPayload } = require("./controllers/bookController");
const { DEFAULT_CATEGORIES } = require("./data/defaultCategories");

function loadSourceBooks() {
  const candidates = [
    process.env.BOOKS_SEED_FILE,
    path.join(__dirname, "../../sachmoi_books.json"),
    path.join(__dirname, "../../../crawl-data-book/sachmoi_books.json"),
  ].filter(Boolean);

  const seedFile = candidates.find((filePath) => fs.existsSync(filePath));
  if (!seedFile) {
    console.warn("No book seed JSON found. Skipping book seed.");
    return [];
  }

  return require(seedFile);
}

async function seedBooks() {
  const sourceBooks = loadSourceBooks();
  if (sourceBooks.length === 0) return;

  let count = 0;

  for (let i = 0; i < sourceBooks.length; i += 1) {
    const item = sourceBooks[i];
    if (!item.slug || !item.title) continue;

    await Book.findOneAndUpdate(
      { slug: item.slug },
      { $set: buildBookPayload(item, i) },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    count += 1;
  }

  console.log(`Seeded ${count} books.`);
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

async function seedCategories() {
  for (const category of DEFAULT_CATEGORIES) {
    await Category.findOneAndUpdate(
      { sourceValue: category.sourceValue },
      {
        $set: {
          ...category,
          slug: slugify(category.name),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
  }

  console.log(`Seeded ${DEFAULT_CATEGORIES.length} categories.`);
}

if (require.main === module) {
  connectDB()
    .then(seedCategories)
    .then(seedBooks)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Cannot seed books", error);
      process.exit(1);
    });
}

module.exports = { seedBooks, seedCategories };

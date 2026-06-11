require("dotenv").config();

const path = require("path");
const connectDB = require("./config/db");
const Book = require("./models/Book");
const { buildBookPayload } = require("./controllers/bookController");

const sourceBooks = require(path.join(__dirname, "../../sachmoi_books.json"));

async function seedBooks() {
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

if (require.main === module) {
  connectDB()
    .then(seedBooks)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Cannot seed books", error);
      process.exit(1);
    });
}

module.exports = { seedBooks };

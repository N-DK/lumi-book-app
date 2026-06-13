require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Book = require("./models/Book");
const Bookmark = require("./models/Bookmark");
const Category = require("./models/Category");
const MusicTrack = require("./models/MusicTrack");
const Playlist = require("./models/Playlist");
const ReadingProgress = require("./models/ReadingProgress");
const User = require("./models/User");
const { seedBooks, seedCategories } = require("./seed");

const models = [
  User,
  Category,
  Book,
  Bookmark,
  ReadingProgress,
  MusicTrack,
  Playlist,
];

async function initDatabase() {
  await connectDB();

  for (const model of models) {
    await model.createCollection();
    await model.syncIndexes();
    console.log(`Ready collection: ${model.collection.name}`);
  }

  await seedCategories();
  if (process.env.SEED_BOOKS_ON_START === "true") {
    await seedBooks();
  } else {
    console.log("Skipped book seed. Set SEED_BOOKS_ON_START=true to enable it.");
  }
  console.log("Database schema, indexes, and seed data are ready.");
}

if (require.main === module) {
  initDatabase()
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error("Cannot initialize database", error);
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    });
}

module.exports = { initDatabase };

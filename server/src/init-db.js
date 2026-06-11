require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Book = require("./models/Book");
const Bookmark = require("./models/Bookmark");
const MusicTrack = require("./models/MusicTrack");
const Playlist = require("./models/Playlist");
const ReadingProgress = require("./models/ReadingProgress");
const User = require("./models/User");
const { seedBooks } = require("./seed");

const models = [User, Book, Bookmark, ReadingProgress, MusicTrack, Playlist];

async function initDatabase() {
  await connectDB();

  for (const model of models) {
    await model.createCollection();
    await model.syncIndexes();
    console.log(`Ready collection: ${model.collection.name}`);
  }

  await seedBooks();
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

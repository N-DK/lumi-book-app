require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const { seedBooks } = require("./seed");

const port = Number(process.env.PORT) || 4000;

async function start() {
  await connectDB();

  if (process.env.SEED_BOOKS_ON_START === "true") {
    await seedBooks();
  }

  app.listen(port, () => {
    console.log(`Lumi API listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Cannot start server", error);
  process.exit(1);
});

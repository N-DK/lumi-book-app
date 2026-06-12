const app = require("../server/src/app");
const connectDB = require("../server/src/config/db");

let dbReady;

module.exports = async function handler(req, res) {
  if (!dbReady) {
    dbReady = connectDB();
  }

  await dbReady;
  return app(req, res);
};

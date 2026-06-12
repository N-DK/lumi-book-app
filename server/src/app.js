require("dotenv").config();

const cors = require("cors");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const morgan = require("morgan");
const passport = require("passport");
const configurePassport = require("./config/passport");
const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/bookRoutes");
const bookmarkRoutes = require("./routes/bookmarkRoutes");
const playlistRoutes = require("./routes/playlistRoutes");
const progressRoutes = require("./routes/progressRoutes");
const userRoutes = require("./routes/userRoutes");
const youtubeRoutes = require("./routes/youtubeRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const clientUrl = process.env.CLIENT_URL ?? "http://localhost:3000";
const sessionSecret = process.env.SESSION_SECRET ?? "dev-session-secret";

configurePassport(passport);

app.set("trust proxy", 1);
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  }),
);
app.use(express.json({ limit: "32mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  session({
    name: "lumi.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "lumi-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/youtube", youtubeRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Không tìm thấy route ${req.method} ${req.path}` });
});

app.use(errorHandler);

module.exports = app;

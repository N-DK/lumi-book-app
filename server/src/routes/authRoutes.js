const express = require("express");
const passport = require("passport");
const { getCurrentUser, logout } = require("../controllers/authController");

const router = express.Router();

router.get("/me", getCurrentUser);

router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      message: "Google OAuth chưa được cấu hình trên server.",
    });
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL ?? "http://localhost:3000"}/login?error=google`,
  }),
  (_req, res) => {
    res.redirect(process.env.CLIENT_URL ?? "http://localhost:3000");
  },
);

router.post("/logout", logout);

module.exports = router;

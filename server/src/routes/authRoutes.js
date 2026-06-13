const express = require("express");
const passport = require("passport");
const { getCurrentUser, logout } = require("../controllers/authController");

const router = express.Router();

function getRequestOrigin(req) {
  const forwardedProto = req.get("x-forwarded-proto");
  const forwardedHost = req.get("x-forwarded-host");
  const protocol = forwardedProto?.split(",")[0]?.trim() || req.protocol;
  const host = forwardedHost?.split(",")[0]?.trim() || req.get("host");

  return `${protocol}://${host}`;
}

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
    callbackURL: `${getRequestOrigin(req)}/api/auth/google/callback`,
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  const origin = getRequestOrigin(req);

  passport.authenticate("google", (error, user) => {
    if (error || !user) {
      return res.redirect(`${origin}/login?error=google`);
    }

    return req.logIn(user, (loginError) => {
      if (loginError) return next(loginError);
      return res.redirect(origin);
    });
  })(req, res, next);
});

router.post("/logout", logout);

module.exports = router;

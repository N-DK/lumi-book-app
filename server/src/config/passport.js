const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const { ensureDefaultPlaylist } = require("../controllers/playlistController");

function configurePassport(passport) {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.SERVER_URL ?? "http://localhost:4000"}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) throw new Error("Google account does not expose an email.");

          const avatarUrl = profile.photos?.[0]?.value ?? "";
          const user = await User.findOneAndUpdate(
            { googleId: profile.id },
            {
              $set: {
                email,
                name: profile.displayName || email,
                avatarUrl,
                lastLoginAt: new Date(),
              },
            },
            { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
          );

          await ensureDefaultPlaylist(user._id);
          done(null, user);
        } catch (error) {
          done(error);
        }
      },
    ),
  );
}

module.exports = configurePassport;

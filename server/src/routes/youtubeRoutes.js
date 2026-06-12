const express = require("express");
const {
  getYoutubeTrackInfo,
  streamYoutubeAudio,
} = require("../controllers/youtubeController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/info", getYoutubeTrackInfo);
router.get("/audio", streamYoutubeAudio);

module.exports = router;

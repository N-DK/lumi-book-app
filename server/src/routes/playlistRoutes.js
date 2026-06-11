const express = require("express");
const {
  addTrack,
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  removeTrack,
  updatePlaylist,
} = require("../controllers/playlistController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", listPlaylists);
router.post("/", createPlaylist);
router.patch("/:playlistId", updatePlaylist);
router.delete("/:playlistId", deletePlaylist);
router.post("/:playlistId/tracks", addTrack);
router.delete("/:playlistId/tracks/:trackId", removeTrack);

module.exports = router;

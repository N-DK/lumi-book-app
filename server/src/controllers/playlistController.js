const Playlist = require("../models/Playlist");
const MusicTrack = require("../models/MusicTrack");
const asyncHandler = require("../utils/asyncHandler");

async function ensureDefaultPlaylist(userId) {
  return Playlist.findOneAndUpdate(
    { user: userId, isDefault: true },
    {
      $setOnInsert: {
        user: userId,
        name: "Nhạc của tôi",
        isDefault: true,
        tracks: [],
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).populate("tracks");
}

const listPlaylists = asyncHandler(async (req, res) => {
  await ensureDefaultPlaylist(req.user._id);
  const playlists = await Playlist.find({ user: req.user._id })
    .populate("tracks")
    .sort({ isDefault: -1, createdAt: -1 });
  res.json({ playlists });
});

const createPlaylist = asyncHandler(async (req, res) => {
  const playlist = await Playlist.create({
    user: req.user._id,
    name: req.body.name || "Playlist mới",
    description: req.body.description || "",
  });
  res.status(201).json({ playlist: await playlist.populate("tracks") });
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const playlist = await Playlist.findOneAndUpdate(
    { _id: req.params.playlistId, user: req.user._id },
    {
      name: req.body.name,
      description: req.body.description,
    },
    { returnDocument: "after", runValidators: true },
  ).populate("tracks");

  if (!playlist) return res.status(404).json({ message: "Không tìm thấy playlist." });
  res.json({ playlist });
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const playlist = await Playlist.findOneAndDelete({
    _id: req.params.playlistId,
    user: req.user._id,
    isDefault: false,
  });

  if (!playlist) {
    return res.status(404).json({ message: "Không tìm thấy playlist hoặc không thể xóa playlist mặc định." });
  }

  res.json({ message: "Đã xóa playlist." });
});

const addTrack = asyncHandler(async (req, res) => {
  const playlist = req.params.playlistId
    ? await Playlist.findOne({ _id: req.params.playlistId, user: req.user._id })
    : await ensureDefaultPlaylist(req.user._id);

  if (!playlist) return res.status(404).json({ message: "Không tìm thấy playlist." });

  const track = await MusicTrack.create({
    user: req.user._id,
    title: req.body.title,
    artist: req.body.artist || "Tệp của bạn",
    audioUrl: req.body.audioUrl,
    coverUrl: req.body.coverUrl || "",
    duration: Number(req.body.duration) || 0,
    source: req.body.source || "user",
  });

  playlist.tracks.push(track._id);
  await playlist.save();
  await playlist.populate("tracks");

  res.status(201).json({ playlist, track });
});

const removeTrack = asyncHandler(async (req, res) => {
  const playlist = await Playlist.findOne({
    _id: req.params.playlistId,
    user: req.user._id,
  });

  if (!playlist) return res.status(404).json({ message: "Không tìm thấy playlist." });

  playlist.tracks.pull(req.params.trackId);
  await playlist.save();

  await MusicTrack.findOneAndDelete({
    _id: req.params.trackId,
    user: req.user._id,
  });

  await playlist.populate("tracks");
  res.json({ playlist, message: "Đã xóa bài nhạc khỏi playlist." });
});

module.exports = {
  ensureDefaultPlaylist,
  listPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addTrack,
  removeTrack,
};

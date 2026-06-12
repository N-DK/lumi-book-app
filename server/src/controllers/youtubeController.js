const {
  getYoutubeAudioUrl,
  getYoutubeInfo,
  normalizeYoutubeUrl,
  searchYoutubeVideos,
  streamYoutubeMp3,
} = require("../services/youtubeAudioService");
const asyncHandler = require("../utils/asyncHandler");

const getYoutubeTrackInfo = asyncHandler(async (req, res) => {
  const sourceUrl = normalizeYoutubeUrl(req.query.url);
  const track = await getYoutubeInfo(sourceUrl);

  res.json({
    track: {
      ...track,
      audioUrl: getYoutubeAudioUrl(req, sourceUrl),
    },
  });
});

const streamYoutubeAudio = asyncHandler(async (req, res) => {
  const sourceUrl = normalizeYoutubeUrl(req.query.url);
  await streamYoutubeMp3(sourceUrl, res);
});

const searchYoutubeTracks = asyncHandler(async (req, res) => {
  const result = await searchYoutubeVideos(req.query.q, {
    limit: req.query.limit,
    offset: req.query.offset,
  });
  res.json(result);
});

module.exports = {
  getYoutubeTrackInfo,
  searchYoutubeTracks,
  streamYoutubeAudio,
};

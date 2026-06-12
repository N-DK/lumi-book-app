const mongoose = require("mongoose");

const musicTrackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    artist: {
      type: String,
      default: "Unknown artist",
      trim: true,
    },
    audioUrl: {
      type: String,
      required: true,
      trim: true,
    },
    coverUrl: {
      type: String,
      default: "",
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    source: {
      type: String,
      default: "user",
    },
    sourceUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

musicTrackSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("MusicTrack", musicTrackSchema);

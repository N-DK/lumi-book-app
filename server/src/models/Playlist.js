const mongoose = require("mongoose");

const playlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      default: "Nhạc của tôi",
    },
    description: {
      type: String,
      default: "",
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    tracks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MusicTrack",
      },
    ],
  },
  { timestamps: true },
);

playlistSchema.index({ user: 1, isDefault: 1 });

playlistSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("Playlist", playlistSchema);

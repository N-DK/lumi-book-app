const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

const listUsers = asyncHandler(async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users });
});

const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

const updateMe = asyncHandler(async (req, res) => {
  const allowed = {};
  if (typeof req.body.name === "string") allowed.name = req.body.name.trim();
  if (typeof req.body.avatarUrl === "string") allowed.avatarUrl = req.body.avatarUrl.trim();

  const user = await User.findByIdAndUpdate(req.user._id, allowed, {
    returnDocument: "after",
    runValidators: true,
  });

  res.json({ user });
});

const deleteMe = asyncHandler(async (req, res) => {
  await User.findByIdAndDelete(req.user._id);
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("lumi.sid");
      res.json({ message: "Đã xóa tài khoản." });
    });
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "Không tìm thấy user." });
  res.json({ user });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!user) return res.status(404).json({ message: "Không tìm thấy user." });
  res.json({ user });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "Không tìm thấy user." });
  res.json({ message: "Đã xóa user." });
});

module.exports = {
  listUsers,
  getMe,
  updateMe,
  deleteMe,
  getUserById,
  updateUser,
  deleteUser,
};

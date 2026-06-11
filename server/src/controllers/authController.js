const asyncHandler = require("../utils/asyncHandler");

const getCurrentUser = asyncHandler(async (req, res) => {
  res.json({ user: req.user ?? null });
});

const logout = (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error);
    req.session.destroy(() => {
      res.clearCookie("lumi.sid");
      res.json({ message: "Đã đăng xuất." });
    });
  });
};

module.exports = {
  getCurrentUser,
  logout,
};

function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }

  return res.status(401).json({
    message: "Bạn cần đăng nhập bằng Google để sử dụng API này.",
  });
}

function requireAdmin(req, res, next) {
  if (req.user?.role === "admin") return next();

  return res.status(403).json({
    message: "Bạn không có quyền thực hiện thao tác này.",
  });
}

module.exports = {
  requireAuth,
  requireAdmin,
};

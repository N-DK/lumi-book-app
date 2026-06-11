function errorHandler(error, _req, res, _next) {
  console.error(error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Dữ liệu không hợp lệ.",
      details: Object.values(error.errors).map((item) => item.message),
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      message: "Dữ liệu đã tồn tại.",
      fields: Object.keys(error.keyPattern ?? {}),
    });
  }

  return res.status(error.statusCode || 500).json({
    message: error.message || "Có lỗi xảy ra trên server.",
  });
}

module.exports = errorHandler;

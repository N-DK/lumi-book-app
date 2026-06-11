const express = require("express");
const {
  createBook,
  deleteBook,
  downloadBook,
  getBook,
  listBooks,
  listCategories,
  updateBook,
} = require("../controllers/bookController");
const { requireAdmin, requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", listBooks);
router.get("/categories", listCategories);
router.get("/:id", getBook);
router.get("/:id/download", downloadBook);
router.post("/", requireAdmin, createBook);
router.put("/:id", requireAdmin, updateBook);
router.delete("/:id", requireAdmin, deleteBook);

module.exports = router;

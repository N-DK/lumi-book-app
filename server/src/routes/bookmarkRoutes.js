const express = require("express");
const {
  createBookmark,
  deleteBookmark,
  listBookmarks,
} = require("../controllers/bookmarkController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", listBookmarks);
router.post("/", createBookmark);
router.delete("/:bookId", deleteBookmark);

module.exports = router;

const express = require("express");
const {
  deleteProgress,
  getProgress,
  listProgress,
  upsertProgress,
} = require("../controllers/progressController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", listProgress);
router.get("/:bookId", getProgress);
router.put("/:bookId", upsertProgress);
router.delete("/:bookId", deleteProgress);

module.exports = router;

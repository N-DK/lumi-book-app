const express = require("express");
const {
  deleteMe,
  deleteUser,
  getMe,
  getUserById,
  listUsers,
  updateMe,
  updateUser,
} = require("../controllers/userController");
const { requireAdmin, requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/me", getMe);
router.patch("/me", updateMe);
router.delete("/me", deleteMe);

router.get("/", requireAdmin, listUsers);
router.get("/:id", requireAdmin, getUserById);
router.patch("/:id", requireAdmin, updateUser);
router.delete("/:id", requireAdmin, deleteUser);

module.exports = router;

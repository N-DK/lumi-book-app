const Category = require("../models/Category");
const asyncHandler = require("../utils/asyncHandler");

const listCategories = asyncHandler(async (_req, res) => {
  const categoryDocs = await Category.find({ active: true })
    .sort({ order: 1, name: 1 })
    .select("name sourceValue slug order -_id")
    .lean();

  res.json({
    categories: categoryDocs.map((category) => category.name).filter(Boolean),
    items: categoryDocs,
  });
});

module.exports = { listCategories };

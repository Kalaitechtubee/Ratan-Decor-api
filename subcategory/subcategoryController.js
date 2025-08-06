const Subcategory = require("./models");
const Category = require("../category/models");

exports.createSubcategory = async (req, res) => {
  try {
    const { name, categoryId } = req.body;
    const subcategory = await Subcategory.create({ name, categoryId });
    res.status(201).json(subcategory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllSubcategories = async (req, res) => {
  try {
    const subcategories = await Subcategory.findAll({
      include: [{ model: Category, attributes: ["id", "name"] }],
    });
    res.status(200).json(subcategories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

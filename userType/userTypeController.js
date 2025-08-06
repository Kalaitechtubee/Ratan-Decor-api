// backend/userType/controller.js
const UserType = require("./models");
const slugify = require("slugify");

// Create new user type
exports.createUserType = async (req, res) => {
  try {
    const { typeName } = req.body;
    const slug = slugify(typeName, { lower: true });

    const exists = await UserType.findOne({ where: { slug } });
    if (exists) return res.status(400).json({ message: "User type already exists." });

    const userType = await UserType.create({ typeName, slug });
    res.status(201).json(userType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all user types
exports.getAllUserTypes = async (req, res) => {
  try {
    const types = await UserType.findAll({ order: [["id", "ASC"]] });
    res.status(200).json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle active/inactive
exports.toggleUserTypeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userType = await UserType.findByPk(id);
    if (!userType) return res.status(404).json({ message: "UserType not found" });

    userType.isActive = !userType.isActive;
    await userType.save();

    res.status(200).json({ message: "Status updated", userType });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

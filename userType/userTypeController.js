const UserType = require("./models");

// Create a new user type
exports.createUserType = async (req, res) => {
  try {
    const { typeName } = req.body;
    const existing = await UserType.findOne({ where: { typeName } });
    if (existing) return res.status(400).json({ message: "UserType already exists" });

    const userType = await UserType.create({ typeName });
    res.status(201).json(userType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all user types
exports.getAllUserTypes = async (req, res) => {
  try {
    const types = await UserType.findAll();
    res.status(200).json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Change user type active status
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

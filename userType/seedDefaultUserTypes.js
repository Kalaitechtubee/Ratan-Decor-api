const UserType = require("./models");

const defaultTypes = [
  "Residential",
  "Commercial",
  "Modular Kitchen",
  "Others",
];

const seedUserTypes = async () => {
  try {
    for (const typeName of defaultTypes) {
      await UserType.findOrCreate({
        where: { typeName },
        defaults: { isActive: true },
      });
    }
    console.log("✅ Default user types inserted");
  } catch (error) {
    console.error("❌ Error seeding user types:", error);
  }
};

module.exports = seedUserTypes;

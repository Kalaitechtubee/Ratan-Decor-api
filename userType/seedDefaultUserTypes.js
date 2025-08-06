// backend/userType/seedUserTypes.js
const UserType = require("./models");
const slugify = require("slugify");

// List of default user types
const defaultTypes = [
  "Residential",
  "Commercial",
  "Modular Kitchen",
  "Others",
];

const seedUserTypes = async () => {
  try {
    for (const typeName of defaultTypes) {
      const slug = slugify(typeName, { lower: true });

      await UserType.findOrCreate({
        where: { slug },
        defaults: {
          typeName,
          slug,
          isActive: true,
        },
      });
    }

    console.log("✅ Default user types seeded successfully.");
  } catch (error) {
    console.error("❌ Failed to seed user types:", error.message);
  }
};

module.exports = seedUserTypes;

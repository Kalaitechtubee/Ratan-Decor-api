// backend/productUsageType/seedProductUsageTypes.js
const ProductUsageType = require("./models");
const slugify = require("slugify");

// Default product usage types
const defaultUsageTypes = [
  {
    name: "Residential",
    description: "Products designed for residential homes and apartments",
  },
  {
    name: "Commercial",
    description: "Products suitable for commercial spaces like offices, retail stores",
  },
  {
    name: "Modular Kitchen",
    description: "Specialized products for modular kitchen installations",
  },
  {
    name: "Others",
    description: "Miscellaneous products that don't fit other categories",
  },
];

const seedProductUsageTypes = async () => {
  try {
    for (const type of defaultUsageTypes) {
      const slug = slugify(type.name, { lower: true });

      await ProductUsageType.findOrCreate({
        where: { slug },
        defaults: {
          typeName: type.name,
          slug,
          description: type.description,
          isActive: true,
        },
      });
    }

    console.log("✅ Default product usage types seeded successfully.");
  } catch (error) {
    console.error("❌ Failed to seed product usage types:", error.message);
  }
};

module.exports = seedProductUsageTypes;
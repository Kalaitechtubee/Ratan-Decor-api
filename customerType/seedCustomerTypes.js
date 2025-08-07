const CustomerType = require("./models");
const slugify = require("slugify");

// Default customer types for pricing tiers
const defaultCustomerTypes = [
  { name: "General", discount: 0 },
  { name: "Architect", discount: 10 }, // 10% discount
  { name: "Dealer", discount: 15 }, // 15% discount
];

const seedCustomerTypes = async () => {
  try {
    for (const type of defaultCustomerTypes) {
      const slug = slugify(type.name, { lower: true });

      await CustomerType.findOrCreate({
        where: { slug },
        defaults: {
          typeName: type.name,
          slug,
          discountPercentage: type.discount,
          isActive: true,
        },
      });
    }

    console.log("✅ Default customer types seeded successfully.");
  } catch (error) {
    console.error("❌ Failed to seed customer types:", error.message);
  }
};

module.exports = seedCustomerTypes;
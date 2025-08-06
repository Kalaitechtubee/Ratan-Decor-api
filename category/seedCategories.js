const Category = require("./models");
const Subcategory = require("../subcategory/models");

const defaultStructure = {
  Plywood: ["Commercial", "Waterproof"],
  Mica: [
    "1 mm Regular", "1 mm Texture", "1 mm Acrylic", "1.5 mm Acrylic",
    "2mm Acrylic", "Color Core Mica", "Metal Mica", "Designer Mica",
  ],
  Veneer: [
    "Natural", "Recon", "Smoked", "Dyed", "Burl", "Imported", "Designer"
  ],
  "Flush Door & Frames": ["Solid wood", "Plain", "PVC", "Teak door frames", "WPC door frames"],
  Louvers: ["PVC", "Charcoal", "Solid wood", "Flexi", "Exterior", "MDF", "Metal"],
  "Decorative sheets": [
    "Albaster sheets", "Corian Sheets", "Highlighter sheets", "Cane", "Cork", "Stone panels"
  ],
  Others: [],
};

const seedCategoriesAndSubcategories = async () => {
  try {

    for (const [categoryName, subcategories] of Object.entries(defaultStructure)) {
      const [category] = await Category.findOrCreate({ where: { name: categoryName } });

      for (const subName of subcategories) {
        // Check if subcategory with this name already exists (unique on name)
        const [subcategory, created] = await Subcategory.findOrCreate({
          where: { name: subName },
          defaults: { categoryId: category.id },
        });
        // If it exists but categoryId is different, update it to match the current category
        if (!created && subcategory.categoryId !== category.id) {
          subcategory.categoryId = category.id;
          await subcategory.save();
        }
      }
    }

    console.log("✅ Categories & subcategories seeded");
  } catch (error) {
    console.error("❌ Seeding error:", error);
  }
};

module.exports = seedCategoriesAndSubcategories;

const { Category } = require('../models');

const createCategoryWithSubs = async (name, subCategories = []) => {
  // Validate unique category name
  const [parent] = await Category.findOrCreate({
    where: { name, parentId: null },
    defaults: { name, parentId: null },
  });

  for (const sub of subCategories) {
    await Category.findOrCreate({
      where: { name: sub, parentId: parent.id },
      defaults: { name: sub, parentId: parent.id },
    });
  }
};

const initializeCategories = async () => {
  try {
    await createCategoryWithSubs('Plywood', ['Commercial', 'Waterproof']);
    await createCategoryWithSubs('Mica', [
      '1 mm Regular', '1 mm Texture', '1 mm Acrylic',
      '1.5 mm Acrylic', '2mm Acrylic', 'Color Core Mica',
      'Metal Mica', 'Designer Mica'
    ]);
    await createCategoryWithSubs('Veneer', [
      'Natural', 'Recon', 'Smoked', 'Dyed', 'Burl', 'Imported', 'Designer'
    ]);
    await createCategoryWithSubs('Flush Door & Frames', [
      'Solid wood', 'Plain', 'PVC', 'Teak door frames', 'WPC door frames'
    ]);
    await createCategoryWithSubs('Louvers', [
      'PVC', 'Charcoal', 'Solid wood', 'Flexi', 'Exterior', 'MDF', 'Metal'
    ]);
    await createCategoryWithSubs('Decorative sheets', [
      'Albaster sheets', 'Corian Sheets', 'Highlighter sheets', 'Cane', 'Cork', 'Stone panels'
    ]);
    await createCategoryWithSubs('Others', ['Miscellaneous']);

    console.log('✅ Default categories initialized');
  } catch (error) {
    console.error('❌ Category initialization failed:', error);
  }
};

// Don't forget to export the function
module.exports = { initializeCategories };
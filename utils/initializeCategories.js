const { Category, UserType } = require('../models');

const createCategoryWithSubs = async (name, subCategories = [], userTypeId) => {
  // Validate unique category name for userTypeId
  const [parent] = await Category.findOrCreate({
    where: { name, parentId: null, userTypeId },
    defaults: { name, parentId: null, userTypeId },
  });

  for (const sub of subCategories) {
    await Category.findOrCreate({
      where: { name: sub, parentId: parent.id, userTypeId },
      defaults: { name: sub, parentId: parent.id, userTypeId },
    });
  }
};

const initializeCategories = async () => {
  try {
    const userTypes = await UserType.findAll({ where: { isActive: true } });
    if (userTypes.length === 0) {
      console.log('⚠️ No active user types found. Skipping category initialization.');
      return;
    }

    for (const userType of userTypes) {
      await createCategoryWithSubs('Plywood', ['Commercial', 'Waterproof'], userType.id);
      await createCategoryWithSubs('Mica', [
        '1 mm Regular', '1 mm Texture', '1 mm Acrylic',
        '1.5 mm Acrylic', '2mm Acrylic', 'Color Core Mica',
        'Metal Mica', 'Designer Mica'
      ], userType.id);
      await createCategoryWithSubs('Veneer', [
        'Natural', 'Recon', 'Smoked', 'Dyed', 'Burl', 'Imported', 'Designer'
      ], userType.id);
      await createCategoryWithSubs('Flush Door & Frames', [
        'Solid wood', 'Plain', 'PVC', 'Teak door frames', 'WPC door frames'
      ], userType.id);
      await createCategoryWithSubs('Louvers', [
        'PVC', 'Charcoal', 'Solid wood', 'Flexi', 'Exterior', 'MDF', 'Metal'
      ], userType.id);
      await createCategoryWithSubs('Decorative sheets', [
        'Albaster sheets', 'Corian Sheets', 'Highlighter sheets', 'Cane', 'Cork', 'Stone panels'
      ], userType.id);
      await createCategoryWithSubs('Others', ['Miscellaneous'], userType.id);
    }

    console.log('✅ Default categories initialized for all active user types');
  } catch (error) {
    console.error('❌ Category initialization failed:', error);
  }
};

// Add this function to export
const initializeCategoriesForUserType = async (userTypeId) => {
  try {
    await createCategoryWithSubs('Plywood', ['Commercial', 'Waterproof'], userTypeId);
    await createCategoryWithSubs('Mica', [
      '1 mm Regular', '1 mm Texture', '1 mm Acrylic',
      '1.5 mm Acrylic', '2mm Acrylic', 'Color Core Mica',
      'Metal Mica', 'Designer Mica'
    ], userTypeId);
    await createCategoryWithSubs('Veneer', [
      'Natural', 'Recon', 'Smoked', 'Dyed', 'Burl', 'Imported', 'Designer'
    ], userTypeId);
    await createCategoryWithSubs('Flush Door & Frames', [
      'Solid wood', 'Plain', 'PVC', 'Teak door frames', 'WPC door frames'
    ], userTypeId);
    await createCategoryWithSubs('Louvers', [
      'PVC', 'Charcoal', 'Solid wood', 'Flexi', 'Exterior', 'MDF', 'Metal'
    ], userTypeId);
    await createCategoryWithSubs('Decorative sheets', [
      'Albaster sheets', 'Corian Sheets', 'Highlighter sheets', 'Cane', 'Cork', 'Stone panels'
    ], userTypeId);
    await createCategoryWithSubs('Others', ['Miscellaneous'], userTypeId);
    
    console.log(`✅ Categories initialized for user type ID: ${userTypeId}`);
  } catch (error) {
    console.error(`❌ Failed to initialize categories for user type ID: ${userTypeId}`, error);
  }
};

// Don't forget to export the function
module.exports = { initializeCategories, initializeCategoriesForUserType };
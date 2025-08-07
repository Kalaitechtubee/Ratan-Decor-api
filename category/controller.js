const Category = require('./models');

const createDefaultCategories = async () => {
  const categories = [
    { name: 'Plywood', subCategories: ['Commercial', 'Waterproof'] },
    { name: 'Mica', subCategories: ['1 mm Regular', '1 mm Texture', '1 mm Acrylic'] },
    { name: 'Veneer', subCategories: ['Natural', 'Recon', 'Smoked'] },
    { name: 'Flush Door & Frames', subCategories: ['Solid wood', 'Plain', 'PVC'] },
    { name: 'PVC', subCategories: ['Charcoal', 'Solid wood', 'Flexi'] },
    { name: 'Decorative sheets', subCategories: ['Albaster sheets', 'Corian Sheets'] }
  ];

  for (const category of categories) {
    const [parent] = await Category.findOrCreate({
      where: { name: category.name, parentId: null }
    });

    for (const sub of category.subCategories) {
      await Category.findOrCreate({
        where: { name: sub, parentId: parent.id }
      });
    }
  }

  console.log('✅ Default categories initialized');
};

const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createDefaultCategories,
  getAllCategories
};

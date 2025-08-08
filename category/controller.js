const { Category } = require('../models');

const createDefaultCategories = async () => {
  try {
    const categories = [
      { name: 'Plywood', subCategories: ['Commercial', 'Waterproof'] },
      { 
        name: 'Mica', 
        subCategories: [
          '1 mm Regular', 
          '1 mm Texture', 
          '1 mm Acrylic',
          '1.5 mm Acrylic',
          '2mm Acrylic',
          'Color Core Mica',
          'Metal Mica',
          'Designer Mica'
        ] 
      },
      { 
        name: 'Veneer', 
        subCategories: [
          'Natural', 
          'Recon', 
          'Smoked',
          'Dyed',
          'Burl',
          'Imported',
          'Designer'
        ] 
      },
      { 
        name: 'Flush Door & Frames', 
        subCategories: [
          'Solid wood', 
          'Plain', 
          'PVC',
          'Teak door frames',
          'WPC door frames'
        ] 
      },
      { 
        name: 'Louvers', 
        subCategories: [
          'PVC', 
          'Charcoal', 
          'Solid wood',
          'Flexi',
          'Exterior',
          'MDF',
          'Metal'
        ] 
      },
      { 
        name: 'Decorative sheets', 
        subCategories: [
          'Albaster sheets', 
          'Corian Sheets',
          'Highlighter sheets',
          'Cane',
          'Cork',
          'Stone panels'
        ] 
      },
      { name: 'Others', subCategories: ['Miscellaneous'] }
    ];

    for (const category of categories) {
      const [parent] = await Category.findOrCreate({
        where: { name: category.name, parentId: null },
        defaults: { name: category.name }
      });

      for (const sub of category.subCategories) {
        await Category.findOrCreate({
          where: { name: sub, parentId: parent.id },
          defaults: { name: sub, parentId: parent.id }
        });
      }
    }

    console.log('✅ Default categories initialized');
  } catch (error) {
    console.error('❌ Category initialization failed:', error);
  }
};

const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      include: [{
        model: Category,
        as: 'SubCategories',
        attributes: ['id', 'name']
      }],
      where: { parentId: null }
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSubCategories = async (req, res) => {
  try {
    const { parentId } = req.params;
    const subCategories = await Category.findAll({
      where: { parentId },
      attributes: ['id', 'name']
    });
    res.json(subCategories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createDefaultCategories,
  getAllCategories,
  getSubCategories
};

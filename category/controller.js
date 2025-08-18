const { Category, UserType, Product } = require('../models');
const { Op } = require('sequelize');

// Utility: Build recursive category tree
const buildTree = (categories, parentId = null) => {
  // Add debug logging
  console.log(`Building tree for parentId: ${parentId}, found ${categories.filter(c => c.parentId === parentId).length} matching categories`);
  console.log('Categories being processed:', JSON.stringify(categories));
  
  return categories
    .filter(c => c.parentId === parentId)
    .map(c => ({
      id: c.id,
      name: c.name,
      userTypeId: c.userTypeId,
      // Use a default value if userTypeName is empty
      userTypeName: c.userTypeName || 'Default',
      subCategories: buildTree(categories, c.id),
    }));
};

// Utility: Get all descendant IDs recursively
const getDescendants = async (catId) => {
  try {
    let descendants = [];
    const children = await Category.findAll({
      where: { parentId: catId },
      attributes: ['id'],
    });
    for (const child of children) {
      descendants.push(child.id);
      descendants = descendants.concat(await getDescendants(child.id));
    }
    return descendants;
  } catch (error) {
    console.error('Error fetching descendants:', error);
    throw error;
  }
};

// Get all categories as nested tree (filtered by user's type or admin-specified userTypeId)
const getCategoryTree = async (req, res) => {
  try {
    let userTypeId = req.user?.userTypeId;

    // Enhanced debugging
    console.log('Request user object:', JSON.stringify(req.user));
    console.log('Authenticated userTypeId:', userTypeId);

    // Allow admins to specify userTypeId via query param
    if (req.user?.role === 'Admin' && req.query.userTypeId) {
      userTypeId = parseInt(req.query.userTypeId, 10);
      const userType = await UserType.findOne({ where: { id: userTypeId, isActive: true } });
      if (!userType) {
        return res.status(404).json({ success: false, message: 'User type not found or inactive' });
      }
    }

    if (!userTypeId) {
      return res.status(400).json({ success: false, message: 'User type ID is required' });
    }

    console.log(`Fetching category tree for userTypeId: ${userTypeId}`);
    const categories = await Category.findAll({
      where: { userTypeId },
      include: [
        {
          model: UserType,
          as: 'userType',
          attributes: ['name'],
        },
      ],
      raw: true,
      nest: true,
    });

    // Log the raw categories for debugging
    console.log('Raw categories fetched:', JSON.stringify(categories));

    if (!categories.length) {
      console.log(`No categories found for userTypeId: ${userTypeId}`);
      return res.status(200).json([]);
    }

    // Build tree with userTypeName
    const mappedCategories = categories.map(c => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId, // Make sure parentId is included
      userTypeId: c.userTypeId,
      userTypeName: c.userType?.name || 'Default',
    }));
    
    console.log('Mapped categories:', JSON.stringify(mappedCategories));
    
    const tree = buildTree(mappedCategories);

    // Log the constructed tree for debugging
    console.log('Constructed category tree:', JSON.stringify(tree));

    res.json(tree);
  } catch (err) {
    console.error('Error fetching category tree:', err);
    res.status(500).json({ success: false, message: `Failed to fetch categories: ${err.message}` });
  }
};

// Get subcategories by parentId (filtered by user's type or admin-specified userTypeId)
const getSubCategories = async (req, res) => {
  try {
    const { parentId } = req.params;
    let userTypeId = req.user?.userTypeId;

    // Allow admins to specify userTypeId via query param
    if (req.user?.role === 'Admin' && req.query.userTypeId) {
      userTypeId = parseInt(req.query.userTypeId, 10);
      const userType = await UserType.findOne({ where: { id: userTypeId, isActive: true } });
      if (!userType) {
        return res.status(404).json({ success: false, message: 'User type not found or inactive' });
      }
    }

    if (!userTypeId) {
      return res.status(400).json({ success: false, message: 'User type ID is required' });
    }

    console.log(`Fetching subcategories for parentId: ${parentId || 'null'}, userTypeId: ${userTypeId}`);
    const subCategories = await Category.findAll({
      where: { parentId: parentId || null, userTypeId },
      attributes: ['id', 'name', 'userTypeId'],
      include: [
        {
          model: UserType,
          as: 'userType',
          attributes: ['name'],
        },
        {
          model: Product,
          as: 'products',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
    });

    if (!subCategories.length) {
      console.log(`No subcategories found for parentId: ${parentId || 'null'}, userTypeId: ${userTypeId}`);
      return res.status(200).json([]);
    }

    // Map to include userTypeName and related products
    const response = subCategories.map(c => {
      const products = c.products ? c.products.map(p => ({
        productId: p.id,
        productName: p.name,
      })) : [];
      return {
        id: c.id,
        name: c.name,
        userTypeId: c.userTypeId,
        userTypeName: c.userType.name,
        products: products,
      };
    });

    res.json(response);
  } catch (err) {
    console.error('Error fetching subcategories:', err);
    res.status(500).json({ success: false, message: `Failed to fetch subcategories: ${err.message}` });
  }
};

// Create a new category or subcategory (Admin/Manager, specify userTypeId)
const createCategory = async (req, res) => {
  try {
    const { name, parentId, userTypeId } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    if (!userTypeId) {
      return res.status(400).json({ success: false, message: 'User type ID is required' });
    }

    const userType = await UserType.findOne({ where: { id: userTypeId, isActive: true } });
    if (!userType) {
      return res.status(404).json({ success: false, message: 'User type not found or inactive' });
    }

    if (parentId) {
      const parent = await Category.findByPk(parentId);
      if (!parent) {
        return res.status(404).json({ success: false, message: 'Parent category not found' });
      }
      if (parent.userTypeId !== userTypeId) {
        return res.status(400).json({ success: false, message: 'Parent category belongs to a different user type' });
      }
    }

    // Check for duplicate name within userTypeId and parentId
    const existingCategory = await Category.findOne({
      where: { name: name.trim(), userTypeId, parentId: parentId || null },
    });
    if (existingCategory) {
      return res.status(409).json({ success: false, message: 'Category name already exists for this user type and parent' });
    }

    const category = await Category.create({
      name: name.trim(),
      parentId: parentId || null,
      userTypeId,
    });

    console.log(`Created category: ${name} with userTypeId: ${userTypeId}`);
    res.status(201).json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        parentId: category.parentId,
        userTypeId: category.userTypeId,
        userTypeName: userType.name,
      },
    });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ success: false, message: `Failed to create category: ${err.message}` });
  }
};

// Update category (Admin/Manager, can update userTypeId with cascade to descendants)
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, userTypeId: newUserTypeId } = req.body;

    const category = await Category.findByPk(id, {
      include: [{ model: UserType, as: 'userType', attributes: ['name'] }],
    });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    let updatedUserType = category.userType;
    if (newUserTypeId && newUserTypeId !== category.userTypeId) {
      const userType = await UserType.findOne({ where: { id: newUserTypeId, isActive: true } });
      if (!userType) {
        return res.status(404).json({ success: false, message: 'User type not found or inactive' });
      }

      const descIds = await getDescendants(category.id);
      await category.update({ userTypeId: newUserTypeId });
      if (descIds.length > 0) {
        await Category.update(
          { userTypeId: newUserTypeId },
          { where: { id: { [Op.in]: descIds } } }
        );
      }
      console.log(`Updated userTypeId to ${newUserTypeId} for category ${id} and ${descIds.length} descendants`);
      updatedUserType = userType;
    }

    if (name && name.trim() !== category.name) {
      // Check for duplicate name within userTypeId and parentId
      const existingCategory = await Category.findOne({
        where: {
          name: name.trim(),
          userTypeId: category.userTypeId,
          parentId: category.parentId,
          id: { [Op.ne]: id },
        },
      });
      if (existingCategory) {
        return res.status(409).json({ success: false, message: 'Category name already exists for this user type and parent' });
      }
      await category.update({ name: name.trim() });
      console.log(`Updated name to ${name} for category ${id}`);
    }

    res.json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        userTypeId: category.userTypeId,
        userTypeName: updatedUserType.name,
        parentId: category.parentId,
      },
    });
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ success: false, message: `Failed to update category: ${err.message}` });
  }
};

// Delete category (subcategories cascade) (Admin/Manager)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Check if category or its descendants have associated products
    const descendantIds = await getDescendants(id);
    const allCategoryIds = [id, ...descendantIds];
    const productCount = await Product.count({
      where: { categoryId: { [Op.in]: allCategoryIds } },
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. ${productCount} product(s) are associated with this category or its subcategories.`,
      });
    }

    await category.destroy(); // CASCADE will delete subcategories
    console.log(`Deleted category ${id}`);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ success: false, message: `Failed to delete category: ${err.message}` });
  }
};

module.exports = {
  getCategoryTree,
  getSubCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
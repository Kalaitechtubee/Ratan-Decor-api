const { Category, Product, sequelize } = require('../models');
const { Op, Sequelize } = require('sequelize');

// Utility: Build recursive category tree with improved structure
const buildTree = (categories, parentId = null) => {
  return categories
    .filter(c => c.parentId === parentId)
    .map(c => ({
      id: c.id,
      name: c.name,
      brandName: c.brandName,
      parentId: c.parentId,
      isSubcategory: !!c.parentId,
      productCount: c.productCount || 0,
      subCategories: buildTree(categories, c.id),
    }));
};

// Utility: Get all descendant IDs recursively with improved error handling
const getDescendants = async (catId) => {
  try {
    const descendants = [];
    const queue = [catId];
    
    while (queue.length > 0) {
      const currentId = queue.shift();
      const children = await Category.findAll({
        where: { parentId: currentId },
        attributes: ['id'],
      });
      
      for (const child of children) {
        descendants.push(child.id);
        queue.push(child.id);
      }
    }
    
    return descendants;
  } catch (error) {
    console.error('Error fetching descendants:', error);
    throw new Error('Failed to fetch category descendants');
  }
};

// Get all categories as nested tree with product counts
const getCategoryTree = async (req, res) => {
  try {
    // Fetch categories with product counts
    const categories = await Category.findAll({
      include: [
        {
          model: Product,
          as: 'products',
          attributes: [],
          required: false,
        }
      ],
      attributes: [
        'id', 
        'name', 
        'parentId',
        'brandName',
        [sequelize.fn('COUNT', sequelize.col('products.id')), 'productCount']
      ],
      group: ['Category.id'],
      raw: true,
      nest: true,
    });

    if (!categories.length) {
      return res.status(200).json({ 
        success: true, 
        categories: [],
        message: 'No categories found'
      });
    }

    // Build tree structure
    const mappedCategories = categories.map(c => ({
      id: c.id,
      name: c.name,
      brandName: c.brandName,
      parentId: c.parentId,
      productCount: parseInt(c.productCount) || 0,
    }));
    
    const tree = buildTree(mappedCategories);

    res.json({ 
      success: true, 
      categories: tree,
      totalCategories: categories.length
    });
  } catch (err) {
    console.error('Error fetching category tree:', err);
    
    // Check for specific error types
    if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeDatabaseError') {
      return res.status(500).json({ 
        success: false, 
        message: 'Database query error. Please check your request parameters.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch categories',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get a single category/subcategory by ID with enhanced details
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID parameter
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid category ID' 
      });
    }

    const category = await Category.findOne({
      where: { id: categoryId },
      include: [
        {
          model: Product,
          as: 'products',
          attributes: [
            'id',
            'name',
            'mrpPrice',
            'generalPrice',
            'architectPrice',
            'dealerPrice',
            'isActive'
          ],
          where: { isActive: true },
          required: false,
        },
        {
          model: Category,
          as: 'subCategories',
          attributes: ['id', 'name', 'brandName'],
          required: false,
        },
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name', 'brandName'],
          required: false,
        }
      ],
    });

    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    const response = {
      id: category.id,
      name: category.name,
      brandName: category.brandName,
      parentId: category.parentId,
      parentName: category.parent?.name || null,
      isSubcategory: !!category.parentId,
      productCount: category.products?.length || 0,
      subcategoryCount: category.subCategories?.length || 0,
      products: category.products?.map(p => ({
        productId: p.id,
        productName: p.name,
        productPrice: p.price,
        isActive: p.isActive,
      })) || [],
      subCategories: category.subCategories?.map(s => ({
        id: s.id,
        name: s.name,
        brandName: s.brandName
      })) || [],
    };

    res.json({ success: true, category: response });
  } catch (err) {
    console.error('Error fetching category:', err);
    
    // Check for specific error types
    if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeDatabaseError') {
      return res.status(500).json({ 
        success: false, 
        message: 'Database query error. Please check your request parameters.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch category',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get subcategories by parentId with pagination support
const getSubCategories = async (req, res) => {
  try {
    const { parentId } = req.params;
    
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Validate parentId
    const categoryId = parentId === 'null' ? null : parseInt(parentId, 10);
    if (parentId !== 'null' && isNaN(categoryId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid parent category ID' 
      });
    }

    // Find subcategories with pagination
    const { count: totalCount, rows: subcategories } = await Category.findAndCountAll({
      where: { parentId: categoryId },
      attributes: ['id', 'name', 'brandName', 'parentId'],
      include: [
        {
          model: Product,
          as: 'products',
          attributes: [],
          required: false,
        },
        {
          model: Category,
          as: 'subCategories',
          attributes: ['id'],
          required: false,
        }
      ],
      limit,
      offset,
      order: [['name', 'ASC']],
    });

    // Get product and subcategory counts
    const response = await Promise.all(subcategories.map(async (subcat) => {
      const productCount = await Product.count({
        where: { categoryId: subcat.id, isActive: true }
      });
      
      const subcategoryCount = await Category.count({
        where: { parentId: subcat.id }
      });
      
      return {
        id: subcat.id,
        name: subcat.name,
        brandName: subcat.brandName,
        parentId: subcat.parentId,
        productCount,
        subcategoryCount,
        isSubcategory: true,
      };
    }));

    res.json({ 
      success: true,
      subcategories: response,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      }
    });
  } catch (err) {
    console.error('Error fetching subcategories:', err);
    
    // Check for specific error types
    if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeDatabaseError') {
      return res.status(500).json({ 
        success: false, 
        message: 'Database query error. Please check your request parameters.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch subcategories',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Create a new main category with enhanced validation
const createCategory = async (req, res) => {
  try {
    const { name, brandName } = req.body;
    
    // Enhanced validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category name must be at least 2 characters long' 
      });
    }
    
    const trimmedName = name.trim();

    // Check for duplicate name (case-insensitive) at root level
    const existingCategory = await Category.findOne({
      where: { 
        name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), Sequelize.fn('LOWER', trimmedName)),
        parentId: null
      },
    });
    
    if (existingCategory) {
      return res.status(409).json({ 
        success: false, 
        message: 'Category name already exists at the root level' 
      });
    }

    // Create category
    const category = await Category.create({
      name: trimmedName,
      parentId: null,
      brandName: brandName || null,
    });

    console.log(`Created main category: ${trimmedName}`);
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: {
        id: category.id,
        name: category.name,
        brandName: category.brandName,
        parentId: null,
        isSubcategory: false,
        productCount: 0,
        subcategoryCount: 0,
      },
    });
  } catch (err) {
    console.error('Error creating category:', err);
    console.error('Error stack:', err.stack);
    
    // Check for specific error types
    if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        success: false, 
        message: 'Category name already exists',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: err.errors.map(e => e.message),
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeDatabaseError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Database error. Please check your input data.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err instanceof TypeError || err instanceof ReferenceError) {
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create category',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Create a new subcategory with enhanced validation
const createSubCategory = async (req, res) => {
  try {
    const { parentId } = req.params;
    const { name, brandName } = req.body;
    
    // Enhanced validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subcategory name must be at least 2 characters long' 
      });
    }
    
    const parsedParentId = parseInt(parentId);
    if (isNaN(parsedParentId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid parent category ID' 
      });
    }

    const trimmedName = name.trim();

    // Validate parent category exists
    const parent = await Category.findByPk(parsedParentId);
    if (!parent) {
      return res.status(404).json({ 
        success: false, 
        message: 'Parent category not found' 
      });
    }

    // Check for duplicate name (case-insensitive) under this parent
    const existingCategory = await Category.findOne({
      where: { 
        name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), Sequelize.fn('LOWER', trimmedName)),
        parentId: parsedParentId
      },
    });
    
    if (existingCategory) {
      return res.status(409).json({ 
        success: false, 
        message: 'Subcategory name already exists under this parent category' 
      });
    }

    // Create subcategory
    const category = await Category.create({
      name: trimmedName,
      parentId: parsedParentId,
      brandName: brandName || null,
    });

    console.log(`Created subcategory: ${trimmedName} under parent ID: ${parsedParentId}`);
    
    res.status(201).json({
      success: true,
      message: 'Subcategory created successfully',
      category: {
        id: category.id,
        name: category.name,
        brandName: category.brandName,
        parentId: category.parentId,
        parentName: parent.name,
        isSubcategory: true,
        productCount: 0,
        subcategoryCount: 0,
      },
    });
  } catch (err) {
    console.error('Error creating subcategory:', err);
    console.error('Error stack:', err.stack);
    
    // Check for specific error types
    if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        success: false, 
        message: 'Subcategory name already exists under this parent',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: err.errors.map(e => e.message),
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeDatabaseError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Database error. Please check your input data.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err instanceof TypeError || err instanceof ReferenceError) {
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create subcategory',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update category with enhanced validation and transaction support
const updateCategory = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { name, brandName, parentId } = req.body;
    
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid category ID' 
      });
    }

    const category = await Category.findByPk(categoryId, {
      transaction
    });
    
    if (!category) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    let updateData = {};

    // Handle name update
    if (name) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Category name must be at least 2 characters long' 
        });
      }

      const trimmedName = name.trim();
      
      // Check for duplicate name (case-insensitive) at the same level
      const existingCategory = await Category.findOne({
        where: { 
          name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), Sequelize.fn('LOWER', trimmedName)),
          parentId: category.parentId,
          id: { [Op.ne]: categoryId }
        },
        transaction
      });
      
      if (existingCategory) {
        await transaction.rollback();
        return res.status(409).json({ 
          success: false, 
          message: 'Category name already exists at this level' 
        });
      }
      
      updateData.name = trimmedName;
    }

    // Handle brandName update
    if (brandName !== undefined) {
      updateData.brandName = brandName || null;
    }

    // Handle parentId update
    if (parentId !== undefined) {
      const parsedParentId = parentId === null ? null : parseInt(parentId, 10);
      
      // Prevent setting parent to self
      if (parsedParentId === categoryId) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Category cannot be its own parent' 
        });
      }
      
      // Prevent setting parent to one of its descendants (would create a cycle)
      if (parsedParentId !== null) {
        const descendants = await getDescendants(categoryId);
        if (descendants.includes(parsedParentId)) {
          await transaction.rollback();
          return res.status(400).json({ 
            success: false, 
            message: 'Cannot set a descendant as the parent (would create a cycle)' 
          });
        }
        
        // Verify the new parent exists
        const parentExists = await Category.findByPk(parsedParentId, { transaction });
        if (!parentExists) {
          await transaction.rollback();
          return res.status(404).json({ 
            success: false, 
            message: 'Parent category not found' 
          });
        }
      }
      
      updateData.parentId = parsedParentId;
    }

    // If no updates were provided
    if (Object.keys(updateData).length === 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No valid updates provided' 
      });
    }

    // Update the category
    await category.update(updateData, { transaction });
    await transaction.commit();

    // Fetch the updated category with associations for the response
    const updatedCategory = await Category.findByPk(category.id, {
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name'],
          required: false,
        }
      ]
    });

    res.json({
      success: true,
      message: 'Category updated successfully',
      category: {
        id: updatedCategory.id,
        name: updatedCategory.name,
        brandName: updatedCategory.brandName,
        parentId: updatedCategory.parentId,
        parentName: updatedCategory.parent?.name || null,
        isSubcategory: !!updatedCategory.parentId,
      }
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating category:', err);
    
    // Check for specific error types
    if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        success: false, 
        message: 'Category name already exists at this level',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: err.errors.map(e => e.message),
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid parent category ID',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeDatabaseError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Database error. Please check your input values.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'TypeError' || err.name === 'ReferenceError') {
      return res.status(500).json({ 
        success: false, 
        message: 'Server error while processing your request',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update category',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Delete category and all its subcategories recursively
// Delete category and its subcategories (products untouched)
const deleteCategory = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid category ID' });
    }

    const category = await Category.findByPk(categoryId, { transaction });
    if (!category) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Get all descendant category IDs
    const descendantIds = await getDescendants(categoryId);
    const allIds = [categoryId, ...descendantIds];

    // ✅ Delete all subcategories first
    if (descendantIds.length > 0) {
      await Category.destroy({ where: { id: { [Op.in]: descendantIds } }, transaction });
    }

    // ✅ Delete main category
    await category.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `Category deleted successfully. ${descendantIds.length} subcategories also deleted.`,
      deletedIds: allIds,
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting category:', err);
    res.status(500).json({ success: false, message: 'Failed to delete category', error: err.message });
  }
};


// Search categories by name
const searchCategories = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query must be at least 2 characters long' 
      });
    }
    
    const trimmedQuery = q.trim();
    
    const categories = await Category.findAll({
      where: {
        name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), 'LIKE', `%${trimmedQuery.toLowerCase()}%`)
      },
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name'],
          required: false,
        }
      ],
      limit: 20,
      order: [['name', 'ASC']]
    });
    
    const results = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      brandName: cat.brandName,
      parentId: cat.parentId,
      parentName: cat.parent?.name || null,
      isSubcategory: !!cat.parentId,
    }));
    
    res.json({
      success: true,
      results,
      count: results.length,
      query: trimmedQuery
    });
  } catch (err) {
    console.error('Error searching categories:', err);
    
    // Check for specific error types
    if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (err.name === 'SequelizeDatabaseError') {
      return res.status(500).json({ 
        success: false, 
        message: 'Database query error. Please check your request parameters.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search categories',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

module.exports = {
  getCategoryTree,
  getCategoryById,
  getSubCategories,
  createCategory,
  createSubCategory,
  updateCategory,
  deleteCategory,
  searchCategories,
};
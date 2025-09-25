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

// FIXED: Get subcategories by parentId with proper null handling
const getSubCategories = async (req, res) => {
  try {
    const { parentId } = req.params;
    
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // FIXED: Proper parentId handling
    let categoryId;
    if (parentId === 'null' || parentId === 'undefined' || !parentId || parentId === '') {
      categoryId = null;
    } else {
      categoryId = parseInt(parentId, 10);
      if (isNaN(categoryId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid parent category ID' 
        });
      }
      
      // Verify parent category exists if not null
      const parentExists = await Category.findByPk(categoryId);
      if (!parentExists) {
        return res.status(404).json({ 
          success: false, 
          message: 'Parent category not found' 
        });
      }
    }

    console.log(`Fetching subcategories for parentId: ${parentId} (parsed as: ${categoryId})`);

    // Find subcategories with pagination
    const { count: totalCount, rows: subcategories } = await Category.findAndCountAll({
      where: { parentId: categoryId },
      attributes: ['id', 'name', 'brandName', 'parentId'],
      limit,
      offset,
      order: [['name', 'ASC']],
    });

    console.log(`Found ${subcategories.length} subcategories`);

    // Get product and subcategory counts for each subcategory
    const response = await Promise.all(subcategories.map(async (subcat) => {
      const productCount = await Product.count({
        where: {
          categoryId: subcat.id,
          isActive: true
        }
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
        isSubcategory: subcat.parentId !== null,
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
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch subcategories',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// FIXED: Create subcategory with proper validation
const createSubCategory = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { parentId } = req.params;
    const { name, brandName } = req.body;
    
    // Enhanced validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Subcategory name must be at least 2 characters long' 
      });
    }
    
    const parsedParentId = parseInt(parentId);
    if (isNaN(parsedParentId)) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid parent category ID' 
      });
    }

    const trimmedName = name.trim();

    // Validate parent category exists
    const parent = await Category.findByPk(parsedParentId, { transaction });
    if (!parent) {
      await transaction.rollback();
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
      transaction
    });
    
    if (existingCategory) {
      await transaction.rollback();
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
    }, { transaction });

    await transaction.commit();

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
    await transaction.rollback();
    console.error('Error creating subcategory:', err);
    
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        success: false, 
        message: 'Subcategory name already exists under this parent',
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

// FIXED: Update category with proper validation and change detection
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
    let hasChanges = false;

    // Handle name update
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Category name must be at least 2 characters long' 
        });
      }

      const trimmedName = name.trim();
      
      // Only check for duplicates if the name is actually changing
      if (trimmedName !== category.name) {
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
        hasChanges = true;
      }
    }

    // Handle brandName update
    if (brandName !== undefined) {
      const newBrandName = brandName || null;
      if (newBrandName !== category.brandName) {
        updateData.brandName = newBrandName;
        hasChanges = true;
      }
    }

    // Handle parentId update
    if (parentId !== undefined) {
      let parsedParentId;
      
      if (parentId === null || parentId === '' || parentId === 'null') {
        parsedParentId = null;
      } else {
        parsedParentId = parseInt(parentId, 10);
        if (isNaN(parsedParentId)) {
          await transaction.rollback();
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid parent category ID' 
          });
        }
      }
      
      // Only update if different from current
      if (parsedParentId !== category.parentId) {
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
        hasChanges = true;
      }
    }

    // If no actual changes were provided
    if (!hasChanges) {
      await transaction.rollback();
      return res.status(200).json({ 
        success: true, 
        message: 'No changes detected - category is already up to date',
        category: {
          id: category.id,
          name: category.name,
          brandName: category.brandName,
          parentId: category.parentId,
          isSubcategory: !!category.parentId,
        }
      });
    }

    console.log(`Updating category ${categoryId} with:`, updateData);

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

    console.log(`Successfully updated category:`, updatedCategory.toJSON());

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
    
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        success: false, 
        message: 'Category name already exists at this level',
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
        mrpPrice: p.mrpPrice,
        generalPrice: p.generalPrice,
        architectPrice: p.architectPrice,
        dealerPrice: p.dealerPrice,
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
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch category',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Create a new main category with enhanced validation
const createCategory = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { name, brandName } = req.body;
    
    // Enhanced validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      await transaction.rollback();
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
      transaction
    });
    
    if (existingCategory) {
      await transaction.rollback();
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
    }, { transaction });

    await transaction.commit();

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
    await transaction.rollback();
    console.error('Error creating category:', err);
    
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        success: false, 
        message: 'Category name already exists',
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

// Delete category and its subcategories with proper transaction handling
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

    // Check if category has any products
    const productCount = await Product.count({
      where: {
        categoryId: categoryId
      },
      transaction
    });

    if (productCount > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${productCount} associated products. Please move or delete the products first.`,
        canForceDelete: true,
        activeProductsCount: productCount,
        affectedCategoryIds: [categoryId]
      });
    }

    // Get all descendant category IDs
    const descendantIds = await getDescendants(categoryId);
    const allIds = [categoryId, ...descendantIds];

    // Delete all subcategories first
    if (descendantIds.length > 0) {
      await Category.destroy({ where: { id: { [Op.in]: descendantIds } }, transaction });
    }

    // Delete main category
    await category.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `Category deleted successfully. ${descendantIds.length} subcategories also deleted.`,
      data: {
        deletedIds: allIds,
        deletedCount: allIds.length
      }
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
      categories: results,
      totalResults: results.length,
      query: trimmedQuery
    });
  } catch (err) {
    console.error('Error searching categories:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search categories',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ADDED: Check category deletion impact
const checkCategoryDeletion = async (req, res) => {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: 'Invalid category ID' });
    }

    const category = await Category.findByPk(categoryId, {
      attributes: ['id', 'name', 'brandName', 'parentId']
    });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Get all descendant categories
    const descendantIds = await getDescendants(categoryId);
    const allCategoryIds = [categoryId, ...descendantIds];

    // Check for products in this category and all subcategories
    const affectedProducts = await Product.findAll({
      where: {
        categoryId: { [Op.in]: allCategoryIds },
        isActive: true
      },
      attributes: ['id', 'name', 'categoryId'],
      limit: 100 // Limit for performance
    });

    const totalAffectedProducts = await Product.count({
      where: {
        categoryId: { [Op.in]: allCategoryIds }
      }
    });

    // Get subcategory details
    const affectedSubcategories = await Category.findAll({
      where: { id: { [Op.in]: descendantIds } },
      attributes: ['id', 'name', 'parentId']
    });

    const canDelete = totalAffectedProducts === 0;

    res.json({
      success: true,
      data: {
        category: {
          id: category.id,
          name: category.name,
          brandName: category.brandName,
          parentId: category.parentId
        },
        canDelete,
        totalAffectedProducts,
        affectedProducts: affectedProducts.map(p => ({
          id: p.id,
          name: p.name,
          categoryId: p.categoryId,
          subcategoryId: p.subcategoryId
        })),
        affectedSubcategories: affectedSubcategories.map(sub => ({
          id: sub.id,
          name: sub.name,
          parentId: sub.parentId
        })),
        affectedCategoryIds: allCategoryIds,
        suggestions: canDelete ? 
          ['Category can be safely deleted'] : 
          [
            'Move products to another category',
            'Deactivate products first',
            'Use force delete with product handling'
          ]
      }
    });
  } catch (err) {
    console.error('Error checking category deletion:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check category deletion impact',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ADDED: Force delete category with product handling options
const forceDeleteCategory = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { action } = req.body;
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
    const allCategoryIds = [categoryId, ...descendantIds];

    // Handle products based on action
    if (action === 'deactivate_products') {
      await Product.update(
        { isActive: false },
        {
          where: {
            categoryId: { [Op.in]: allCategoryIds }
          },
          transaction
        }
      );
    } else if (action === 'move_to_uncategorized') {
      await Product.update(
        { categoryId: null },
        {
          where: {
            categoryId: { [Op.in]: allCategoryIds }
          },
          transaction
        }
      );
    } else if (action === 'delete_products') {
      await Product.destroy({
        where: {
          categoryId: { [Op.in]: allCategoryIds }
        },
        transaction
      });
    } else {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    // Delete all subcategories first
    if (descendantIds.length > 0) {
      await Category.destroy({ where: { id: { [Op.in]: descendantIds } }, transaction });
    }

    // Delete main category
    await category.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `Category force deleted successfully with action: ${action}. ${descendantIds.length} subcategories also deleted.`,
      data: {
        deletedIds: allCategoryIds,
        deletedCount: allCategoryIds.length,
        actionTaken: action
      }
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error force deleting category:', err);
    res.status(500).json({ success: false, message: 'Failed to force delete category', error: err.message });
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
  checkCategoryDeletion, // ADDED this function
  forceDeleteCategory, // ADDED this function
};

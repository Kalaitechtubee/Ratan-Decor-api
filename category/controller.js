const { Category, Product, sequelize } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { generateImageUrl } = require('../utils/imageUtils');

// Utility: Build recursive category tree with improved structure
const buildTree = (categories, parentId = null) => {
  return categories
    .filter(c => c.parentId === parentId)
    .map(c => ({
      id: c.id,
      name: c.name,
      brandName: c.brandName,
      image: c.image, // Will be null for subcategories
      imageUrl: c.image ? generateImageUrl(c.image, null, 'categories') : null,
      parentId: c.parentId,
      isSubcategory: !!c.parentId,
      productCount: c.productCount || 0,
      subCategories: buildTree(categories, c.id),
    }));
};

// Utility: Get all descendant IDs recursively
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
        'image',
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

    const mappedCategories = categories.map(c => ({
      id: c.id,
      name: c.name,
      brandName: c.brandName,
      image: c.image,
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
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch categories',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get subcategories by parentId
const getSubCategories = async (req, res) => {
  try {
    const { parentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

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
      
      const parentExists = await Category.findByPk(categoryId);
      if (!parentExists) {
        return res.status(404).json({ 
          success: false, 
          message: 'Parent category not found' 
        });
      }
    }

    const { count: totalCount, rows: subcategories } = await Category.findAndCountAll({
      where: { parentId: categoryId },
      attributes: ['id', 'name', 'brandName', 'image', 'parentId'],
      limit,
      offset,
      order: [['name', 'ASC']],
    });

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
        image: subcat.image,
        imageUrl: subcat.image ? generateImageUrl(subcat.image, req, 'categories') : null,
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

// Create subcategory - NO IMAGE ALLOWED
const createSubCategory = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { parentId } = req.params;
    const { name, brandName } = req.body;

    // PREVENT IMAGE UPLOAD FOR SUBCATEGORIES
    if (req.file) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Subcategories cannot have images. Only main categories can have images.'
      });
    }

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

    const parent = await Category.findByPk(parsedParentId, { transaction });
    if (!parent) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Parent category not found'
      });
    }

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

    // Create subcategory WITHOUT image
    const category = await Category.create({
      name: trimmedName,
      parentId: parsedParentId,
      brandName: brandName || null,
      image: null, // ALWAYS null for subcategories
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Subcategory created successfully',
      category: {
        id: category.id,
        name: category.name,
        brandName: category.brandName,
        image: null,
        imageUrl: null,
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
    res.status(500).json({
      success: false,
      message: 'Failed to create subcategory',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update category
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

    const category = await Category.findByPk(categoryId, { transaction });
    
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

    // Handle image update - ONLY FOR MAIN CATEGORIES
    if (req.file) {
      if (category.parentId !== null) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Subcategories cannot have images. Only main categories can have images.'
        });
      }

      const imageUrl = req.file.filename; // Store only filename
      if (imageUrl !== category.image) {
        updateData.image = imageUrl;
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
      
      if (parsedParentId !== category.parentId) {
        // If changing from main category to subcategory, remove image
        if (parsedParentId !== null && category.image) {
          updateData.image = null;
          hasChanges = true;
        }

        if (parsedParentId === categoryId) {
          await transaction.rollback();
          return res.status(400).json({ 
            success: false, 
            message: 'Category cannot be its own parent' 
          });
        }
        
        if (parsedParentId !== null) {
          const descendants = await getDescendants(categoryId);
          if (descendants.includes(parsedParentId)) {
            await transaction.rollback();
            return res.status(400).json({ 
              success: false, 
              message: 'Cannot set a descendant as the parent (would create a cycle)' 
            });
          }
          
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

    if (!hasChanges) {
      await transaction.rollback();
      return res.status(200).json({
        success: true,
        message: 'No changes detected - category is already up to date',
        category: {
          id: category.id,
          name: category.name,
          brandName: category.brandName,
          image: category.image,
          imageUrl: category.image ? generateImageUrl(category.image, req, 'categories') : null,
          parentId: category.parentId,
          isSubcategory: !!category.parentId,
        }
      });
    }

    await category.update(updateData, { transaction });
    await transaction.commit();

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
        image: updatedCategory.image,
        imageUrl: updatedCategory.image ? generateImageUrl(updatedCategory.image, req, 'categories') : null,
        parentId: updatedCategory.parentId,
        parentName: updatedCategory.parent?.name || null,
        isSubcategory: !!updatedCategory.parentId,
      }
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating category:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update category',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get a single category by ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

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
          attributes: ['id', 'name', 'mrpPrice', 'generalPrice', 'architectPrice', 'dealerPrice', 'isActive'],
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
      image: category.image,
      imageUrl: category.image ? generateImageUrl(category.image, req, 'categories') : null,
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
        brandName: s.brandName,
        image: null, // Subcategories don't have images
        imageUrl: null
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

// Create a new main category WITH IMAGE
const createCategory = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { name, brandName } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Category name must be at least 2 characters long'
      });
    }

    const trimmedName = name.trim();

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

    // Handle image upload for main categories
    let imageFilename = null;
    if (req.file) {
      imageFilename = req.file.filename; // Store only filename
    }

    const category = await Category.create({
      name: trimmedName,
      parentId: null,
      brandName: brandName || null,
      image: imageFilename,
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: {
        id: category.id,
        name: category.name,
        brandName: category.brandName,
        image: category.image,
        imageUrl: category.image ? generateImageUrl(category.image, req, 'categories') : null,
        parentId: null,
        isSubcategory: false,
        productCount: 0,
        subcategoryCount: 0,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating category:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Delete category
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

    const productCount = await Product.count({
      where: { categoryId: categoryId },
      transaction
    });

    if (productCount > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${productCount} associated products.`,
        canForceDelete: true,
        activeProductsCount: productCount,
      });
    }

    const descendantIds = await getDescendants(categoryId);
    const allIds = [categoryId, ...descendantIds];

    if (descendantIds.length > 0) {
      await Category.destroy({ where: { id: { [Op.in]: descendantIds } }, transaction });
    }

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

// Search categories
const searchCategories = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query must be at least 2 characters long' 
      });
    }
    
    const categories = await Category.findAll({
      where: {
        name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), 'LIKE', `%${q.trim().toLowerCase()}%`)
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
      image: cat.image,
      imageUrl: cat.image ? generateImageUrl(cat.image, req, 'categories') : null,
      parentId: cat.parentId,
      parentName: cat.parent?.name || null,
      isSubcategory: !!cat.parentId,
    }));
    
    res.json({
      success: true,
      categories: results,
      totalResults: results.length,
      query: q.trim()
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

// Check category deletion impact
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

    const descendantIds = await getDescendants(categoryId);
    const allCategoryIds = [categoryId, ...descendantIds];

    const affectedProducts = await Product.findAll({
      where: {
        categoryId: { [Op.in]: allCategoryIds },
        isActive: true
      },
      attributes: ['id', 'name', 'categoryId'],
      limit: 100
    });

    const totalAffectedProducts = await Product.count({
      where: { categoryId: { [Op.in]: allCategoryIds } }
    });

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
          categoryId: p.categoryId
        })),
        affectedSubcategories: affectedSubcategories.map(sub => ({
          id: sub.id,
          name: sub.name,
          parentId: sub.parentId
        })),
        affectedCategoryIds: allCategoryIds,
        suggestions: canDelete ? 
          ['Category can be safely deleted'] : 
          ['Move products to another category', 'Deactivate products first', 'Use force delete']
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

// Force delete category
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

    const descendantIds = await getDescendants(categoryId);
    const allCategoryIds = [categoryId, ...descendantIds];

    if (action === 'deactivate_products') {
      await Product.update(
        { isActive: false },
        { where: { categoryId: { [Op.in]: allCategoryIds } }, transaction }
      );
    } else if (action === 'move_to_uncategorized') {
      await Product.update(
        { categoryId: null },
        { where: { categoryId: { [Op.in]: allCategoryIds } }, transaction }
      );
    } else if (action === 'delete_products') {
      await Product.destroy({
        where: { categoryId: { [Op.in]: allCategoryIds } },
        transaction
      });
    } else {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    if (descendantIds.length > 0) {
      await Category.destroy({ where: { id: { [Op.in]: descendantIds } }, transaction });
    }

    await category.destroy({ transaction });
    await transaction.commit();

    res.json({
      success: true,
      message: `Category force deleted successfully with action: ${action}.`,
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
  checkCategoryDeletion,
  forceDeleteCategory,
};
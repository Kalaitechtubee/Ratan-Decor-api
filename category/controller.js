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

// Utility: Process product data with userType and role-based pricing
const processProductData = (product, req, userType, userRole) => {
  const productData = product.toJSON ? product.toJSON() : product;
  
  const computePrice = (product) =>
    userRole === 'Dealer'
      ? product.dealerPrice
      : userRole === 'Architect'
      ? product.architectPrice
      : product.generalPrice;

  const getImageUrl = (filename) => {
    if (!filename || typeof filename !== 'string') return null;
    if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
    if (filename.startsWith('/uploads/')) return filename;
    return `${req.protocol}://${req.get('host')}/uploads/products/${filename}`;
  };

  let allImageUrls = [];
  if (productData.image) {
    allImageUrls.push(getImageUrl(productData.image));
  }
  if (productData.images && Array.isArray(productData.images)) {
    allImageUrls = [...allImageUrls, ...productData.images.map(img => getImageUrl(img))];
  }
  
  productData.imageUrl = allImageUrls[0] || null;
  productData.imageUrls = allImageUrls;
  productData.price = computePrice(productData);
  
  if (!('brandName' in productData)) productData.brandName = null;
  if (!('designNumber' in productData)) productData.designNumber = null;
  if (!('size' in productData)) productData.size = null;
  if (!('thickness' in productData)) productData.thickness = null;
  if (!('gst' in productData)) productData.gst = null;
  
  return productData;
};

// Utility: Get user role from JWT token
const getReqUserRole = (req) => {
  const auth = req.header('Authorization');
  if (!auth) return 'General';
  const token = auth.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    return decoded.role || 'General';
  } catch {
    return 'General';
  }
};

// Get all categories as nested tree with product counts
const getCategoryTree = async (req, res) => {
  try {
    const { userType } = req.query;
    const userRole = getReqUserRole(req);

    const whereClause = {};
    if (userType) {
      whereClause[Op.and] = sequelize.where(
        sequelize.literal(`JSON_CONTAINS(products.visibleTo, '"${userType}"')`),
        true
      );
    }

    const categories = await Category.findAll({
      include: [
        {
          model: Product,
          as: 'products',
          attributes: [],
          required: false,
          where: userType ? { visibleTo: { [Op.contains]: [userType] } } : {},
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
      totalCategories: categories.length,
      userType: userType || null,
      userRole
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

// Get a single category/subcategory by ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userType } = req.query;
    const userRole = getReqUserRole(req);

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
          attributes: ['id', 'name', 'generalPrice', 'architectPrice', 'dealerPrice', 'isActive', 'image', 'images', 'visibleTo', 'brandName', 'designNumber', 'size', 'thickness', 'gst', 'averageRating', 'totalRatings'],
          where: { 
            isActive: true,
            ...(userType ? { visibleTo: { [Op.contains]: [userType] } } : {})
          },
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
      products: category.products?.map(p => processProductData(p, req, userType, userRole)) || [],
      subCategories: category.subCategories?.map(s => ({
        id: s.id,
        name: s.name,
        brandName: s.brandName
      })) || [],
      userType: userType || null,
      userRole
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

// Get subcategories by parentId with pagination
const getSubCategories = async (req, res) => {
  try {
    const { parentId } = req.params;
    const { userType, page = 1, limit = 10 } = req.query;
    const userRole = getReqUserRole(req);

    const categoryId = parentId === 'null' ? null : parseInt(parentId, 10);
    if (parentId !== 'null' && isNaN(categoryId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid parent category ID' 
      });
    }

    const offset = (page - 1) * limit;
    const { count: totalCount, rows: subcategories } = await Category.findAndCountAll({
      where: { parentId: categoryId },
      attributes: ['id', 'name', 'brandName', 'parentId'],
      include: [
        {
          model: Product,
          as: 'products',
          attributes: [],
          required: false,
          where: userType ? { visibleTo: { [Op.contains]: [userType] } } : {},
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

    const response = await Promise.all(subcategories.map(async (subcat) => {
      const productCount = await Product.count({
        where: { 
          categoryId: subcat.id, 
          isActive: true,
          ...(userType ? { visibleTo: { [Op.contains]: [userType] } } : {})
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
        isSubcategory: true,
      };
    }));

    res.json({ 
      success: true,
      subcategories: response,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: Number(limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      },
      userType: userType || null,
      userRole
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

// Create a new main category
const createCategory = async (req, res) => {
  try {
    const { name, brandName } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
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
    });
    
    if (existingCategory) {
      return res.status(409).json({ 
        success: false, 
        message: 'Category name already exists at the root level' 
      });
    }

    const category = await Category.create({
      name: trimmedName,
      parentId: null,
      brandName: brandName || null,
    });

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
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create category',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Create a new subcategory
const createSubCategory = async (req, res) => {
  try {
    const { parentId } = req.params;
    const { name, brandName } = req.body;
    
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
    const parent = await Category.findByPk(parsedParentId);
    if (!parent) {
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
    });
    
    if (existingCategory) {
      return res.status(409).json({ 
        success: false, 
        message: 'Subcategory name already exists under this parent category' 
      });
    }

    const category = await Category.create({
      name: trimmedName,
      parentId: parsedParentId,
      brandName: brandName || null,
    });

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
    if (name) {
      if (typeof name !== 'string' || name.trim().length < 2) {
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

    if (brandName !== undefined) {
      updateData.brandName = brandName || null;
    }

    if (parentId !== undefined) {
      const parsedParentId = parentId === null ? null : parseInt(parentId, 10);
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
    }

    if (Object.keys(updateData).length === 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No valid updates provided' 
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

// Delete category and its subcategories
const deleteCategory = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    
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

    const descendantIds = await getDescendants(categoryId);
    const allIds = [categoryId, ...descendantIds];
    
    const productsCount = await Product.count({
      where: {
        categoryId: { [Op.in]: allIds },
        isActive: true
      },
      transaction
    });
    
    if (productsCount > 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete: ${productsCount} active products are associated with this category or its subcategories` 
      });
    }

    if (descendantIds.length > 0) {
      await Category.destroy({
        where: { id: { [Op.in]: descendantIds } },
        transaction
      });
    }
    
    await category.destroy({ transaction });
    await transaction.commit();
    
    res.json({
      success: true,
      message: `Category deleted successfully along with ${descendantIds.length} subcategories`,
      deletedIds: allIds
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting category:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete category',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Search categories by name
const searchCategories = async (req, res) => {
  try {
    const { q, userType } = req.query;
    const userRole = getReqUserRole(req);
    
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
        },
        {
          model: Product,
          as: 'products',
          attributes: ['id', 'name', 'generalPrice', 'architectPrice', 'dealerPrice', 'isActive', 'image', 'images', 'visibleTo', 'brandName', 'designNumber', 'size', 'thickness', 'gst', 'averageRating', 'totalRatings'],
          where: { 
            isActive: true,
            ...(userType ? { visibleTo: { [Op.contains]: [userType] } } : {})
          },
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
      productCount: cat.products?.length || 0,
      products: cat.products?.map(p => processProductData(p, req, userType, userRole)) || [],
    }));
    
    res.json({
      success: true,
      results,
      count: results.length,
      query: trimmedQuery,
      userType: userType || null,
      userRole
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

// NEW: Get category by name with userType
const getCategoryByName = async (req, res) => {
  try {
    const { name } = req.params;
    const { userType } = req.query;
    const userRole = getReqUserRole(req);

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category name must be at least 2 characters long' 
      });
    }

    const category = await Category.findOne({
      where: {
        name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), Sequelize.fn('LOWER', name.trim())),
        parentId: null // Only main categories
      },
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id', 'name', 'generalPrice', 'architectPrice', 'dealerPrice', 'isActive', 'image', 'images', 'visibleTo', 'brandName', 'designNumber', 'size', 'thickness', 'gst', 'averageRating', 'totalRatings'],
          where: { 
            isActive: true,
            ...(userType ? { visibleTo: { [Op.contains]: [userType] } } : {})
          },
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
      products: category.products?.map(p => processProductData(p, req, userType, userRole)) || [],
      subCategories: category.subCategories?.map(s => ({
        id: s.id,
        name: s.name,
        brandName: s.brandName
      })) || [],
      userType: userType || null,
      userRole
    };

    res.json({ success: true, category: response });
  } catch (err) {
    console.error('Error fetching category by name:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch category',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// NEW: Get subcategory by name with userType
const getSubCategoryByName = async (req, res) => {
  try {
    const { name } = req.params;
    const { userType } = req.query;
    const userRole = getReqUserRole(req);

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subcategory name must be at least 2 characters long' 
      });
    }

    const category = await Category.findOne({
      where: {
        name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), Sequelize.fn('LOWER', name.trim())),
        parentId: { [Op.ne]: null } // Only subcategories
      },
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id', 'name', 'generalPrice', 'architectPrice', 'dealerPrice', 'isActive', 'image', 'images', 'visibleTo', 'brandName', 'designNumber', 'size', 'thickness', 'gst', 'averageRating', 'totalRatings'],
          where: { 
            isActive: true,
            ...(userType ? { visibleTo: { [Op.contains]: [userType] } } : {})
          },
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
        message: 'Subcategory not found' 
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
      products: category.products?.map(p => processProductData(p, req, userType, userRole)) || [],
      subCategories: category.subCategories?.map(s => ({
        id: s.id,
        name: s.name,
        brandName: s.brandName
      })) || [],
      userType: userType || null,
      userRole
    };

    res.json({ success: true, category: response });
  } catch (err) {
    console.error('Error fetching subcategory by name:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch subcategory',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// NEW: Search categories/subcategories by name with userType and pagination
const searchCategoriesByName = async (req, res) => {
  try {
    const { q, userType, page = 1, limit = 10 } = req.query;
    const userRole = getReqUserRole(req);

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query must be at least 2 characters long' 
      });
    }

    const trimmedQuery = q.trim();
    const offset = (page - 1) * limit;

    const { count, rows: categories } = await Category.findAndCountAll({
      where: {
        name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), 'LIKE', `%${trimmedQuery.toLowerCase()}%`)
      },
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id', 'name', 'generalPrice', 'architectPrice', 'dealerPrice', 'isActive', 'image', 'images', 'visibleTo', 'brandName', 'designNumber', 'size', 'thickness', 'gst', 'averageRating', 'totalRatings'],
          where: { 
            isActive: true,
            ...(userType ? { visibleTo: { [Op.contains]: [userType] } } : {})
          },
          required: false,
        },
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: Category,
          as: 'subCategories',
          attributes: ['id', 'name', 'brandName'],
          required: false,
        }
      ],
      limit: Number(limit),
      offset: Number(offset),
      order: [['name', 'ASC']]
    });

    const results = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      brandName: cat.brandName,
      parentId: cat.parentId,
      parentName: cat.parent?.name || null,
      isSubcategory: !!cat.parentId,
      productCount: cat.products?.length || 0,
      subcategoryCount: cat.subCategories?.length || 0,
      products: cat.products?.map(p => processProductData(p, req, userType, userRole)) || [],
      subCategories: cat.subCategories?.map(s => ({
        id: s.id,
        name: s.name,
        brandName: s.brandName
      })) || [],
    }));

    res.json({
      success: true,
      results,
      count: count,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: Number(limit),
        hasNextPage: page < Math.ceil(count / limit),
        hasPrevPage: page > 1,
      },
      query: trimmedQuery,
      userType: userType || null,
      userRole
    });
  } catch (err) {
    console.error('Error searching categories by name:', err);
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
  getCategoryByName,
  getSubCategoryByName,
  searchCategoriesByName
};

const { Product, Category, ProductRating, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs').promises; // Use promises for async cleanup

const getReqUserRole = (req) => req.user?.role || 'General'; // OPTIMIZED: Use req.user from auth middleware

const computePrice = (product, role) =>
  role.toLowerCase() === 'dealer'
    ? product.dealerPrice
    : role.toLowerCase() === 'architect'
    ? product.architectPrice
    : product.generalPrice;

const validateVisibleTo = (visibleTo) => {
  if (!Array.isArray(visibleTo) || visibleTo.length === 0) return false;
  return true;
};

const getImageUrl = (filename, req, imageType = 'products') => {
  if (!filename || typeof filename !== 'string') return null;
  // ✅ Already a full URL (external or CDN)
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  // ✅ Already a local uploads path
  if (filename.startsWith('/uploads/')) return filename;
  // ✅ Use BASE_URL from .env (works with or without port)
  // Fallback: automatically build from request host (includes port)
  const envBaseUrl = process.env.BASE_URL?.trim();
  const baseUrl = envBaseUrl || `${req.protocol}://${req.get('host')}`;
  // ✅ Build final URL dynamically based on imageType
  return `${baseUrl}/uploads/${imageType}/${filename}`;
};

const processProductData = (product, req) => {
  const productData = product.toJSON ? product.toJSON() : product;
  let allImageUrls = [];
  if (productData.image) {
    allImageUrls.push(getImageUrl(productData.image, req));
  }
  if (productData.images && Array.isArray(productData.images)) {
    allImageUrls = [...allImageUrls, ...productData.images.map(img => getImageUrl(img, req))];
  }
  productData.imageUrl = allImageUrls[0] || null;
  productData.imageUrls = allImageUrls;
  if (!('brandName' in productData)) productData.brandName = null;
  if (!('designNumber' in productData)) productData.designNumber = null;
  if (!('size' in productData)) productData.size = null;
  if (!('thickness' in productData)) productData.thickness = null;
  if (!('gst' in productData)) productData.gst = null;
  if (!('unitType' in productData)) productData.unitType = null;
  return productData;
};

const validateRating = (rating) => {
  const numRating = Number(rating);
  return !isNaN(numRating) && numRating >= 1 && numRating <= 5;
};

const validateColors = (colors) => {
  if (!Array.isArray(colors)) return false;
  return colors.every(color => typeof color === 'string' && color.trim().length > 0);
};

// Helper function to safely parse JSON
const safeJsonParse = (str, fallback = null) => {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch (error) {
    console.warn('JSON parse error:', error.message, 'Input:', str);
    return fallback;
  }
};

// Async file cleanup helper
const cleanupFiles = async (filenames, uploadDir) => {
  await Promise.all(
    filenames.map(async (filename) => {
      const filePath = path.join(uploadDir, filename);
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
      } catch (err) {
        console.warn(`Cleanup failed for ${filename}:`, err.message);
      }
    })
  );
};

const getProducts = async (req, res) => {
  try {
    const {
      userType,
      categoryId,
      subcategoryId,
      minPrice,
      maxPrice,
      search,
      page = 1,
      limit = 20,
      isActive,
      designNumber,
      minDesignNumber,
      maxDesignNumber
    } = req.query;
   
    const userRole = getReqUserRole(req);
    const whereClause = {};
   
    // Active status filter
    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true' || isActive === true;
    }
   
    // User type visibility filter
    if (userType) {
      whereClause[Op.and] = sequelize.where(
        sequelize.literal(`visibleTo LIKE '%"${userType}"%'`),
        true
      );
    }
   
    // Category filters
    if (categoryId) whereClause.categoryId = categoryId;
    if (subcategoryId) whereClause.categoryId = subcategoryId;
   
    // Price range filter
    if (minPrice || maxPrice) {
      whereClause.generalPrice = {};
      if (minPrice) whereClause.generalPrice[Op.gte] = Number(minPrice);
      if (maxPrice) whereClause.generalPrice[Op.lte] = Number(maxPrice);
    }
   
    // CORRECTED: Design number filtering
    if (designNumber && !minDesignNumber && !maxDesignNumber) {
      // Only exact/partial match when no range is specified
      whereClause.designNumber = { [Op.like]: `%${designNumber}%` };
    } else if (minDesignNumber || maxDesignNumber) {
      // Range filter takes priority
      const rangeCondition = {};
      if (minDesignNumber) {
        const num = Number(minDesignNumber);
        rangeCondition[Op.gte] = isNaN(num) ? 0 : num; // FIXED: Handle NaN as 0
      }
      if (maxDesignNumber) {
        const num = Number(maxDesignNumber);
        rangeCondition[Op.lte] = isNaN(num) ? Number.MAX_SAFE_INTEGER : num; // FIXED: Handle NaN
      }
      whereClause.designNumber = rangeCondition;
    }
   
    // Search functionality (ENHANCED: Safer escaping)
    if (search) {
      const escapedSearch = search.trim().replace(/[%_\\]/g, '\\$&'); // Escape SQL wildcards
      const searchConditions = [
        { name: { [Op.like]: `%${escapedSearch}%` } },
        { description: { [Op.like]: `%${escapedSearch}%` } },
        { brandName: { [Op.like]: `%${escapedSearch}%` } },
        { designNumber: { [Op.like]: `%${escapedSearch}%` } },
        sequelize.where(
          sequelize.fn('JSON_SEARCH', sequelize.col('specifications'), 'one', `%${escapedSearch}%`),
          Op.ne, null // FIXED: Use fn for safer JSON search
        )
      ];
     
      // Handle combining search with existing conditions
      if (whereClause[Op.and]) {
        whereClause[Op.and] = [
          ...Array.isArray(whereClause[Op.and]) ? whereClause[Op.and] : [whereClause[Op.and]],
          { [Op.or]: searchConditions }
        ];
      } else {
        whereClause[Op.or] = searchConditions;
      }
    }
   
    const offset = (page - 1) * limit;
   
    // Count queries for different states
    const activeCount = await Product.count({
      where: { ...whereClause, isActive: true }
    });
    const inactiveCount = await Product.count({
      where: { ...whereClause, isActive: false }
    });
    const totalCount = activeCount + inactiveCount;
   
    // Main query
    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'parentId'],
          include: [
            { model: Category, as: 'parent', attributes: ['id', 'name'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset)
    });
   
    // Process products
    const processedProducts = products.map(product => {
      const productData = processProductData(product, req);
      productData.price = computePrice(product, userRole);
      return productData;
    });
   
    res.json({
      products: processedProducts,
      count,
      totalCount,
      activeCount,
      inactiveCount,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      userType: userType || null,
      userRole,
      isActiveFilter: isActive !== undefined ? whereClause.isActive : null,
      designNumberFilter: designNumber || null,
      minDesignNumberFilter: minDesignNumber || null,
      maxDesignNumberFilter: maxDesignNumber || null
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(400).json({ message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    // Enhanced debugging
    console.log('=== CREATE PRODUCT DEBUG ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Request Body Keys:', Object.keys(req.body));
    console.log('Request Body:', req.body);
    console.log('Files Object:', req.files);
   
    // Check if body is empty (multipart not parsed)
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('ERROR: Request body is empty - multipart middleware may not be working');
      return res.status(400).json({
        message: 'Request body is empty. Make sure you are using multipart/form-data and the upload middleware is properly configured.',
        debug: {
          contentType: req.headers['content-type'],
          bodyKeys: Object.keys(req.body || {}),
          hasFiles: !!req.files
        }
      });
    }
    const {
      name,
      description,
      specifications,
      visibleTo,
      mrpPrice,
      generalPrice,
      architectPrice,
      dealerPrice,
      designNumber,
      size,
      thickness,
      categoryId,
      productUsageTypeId,
      colors,
      gst,
      brandName,
      unitType
    } = req.body;
    let subcategoryId = null;
    if (typeof req.body.subcategoryId !== 'undefined') {
      subcategoryId = req.body.subcategoryId;
    }
    // Enhanced validation with better error messages
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      console.error('Validation Error: Invalid name', { name, type: typeof name });
      return res.status(400).json({
        message: 'Product name is required and must be a non-empty string',
        received: { name, type: typeof name }
      });
    }
    // Validate required prices with detailed error messages
    const priceValidations = [
      { field: 'generalPrice', value: generalPrice, name: 'General price' },
      { field: 'architectPrice', value: architectPrice, name: 'Architect price' },
      { field: 'dealerPrice', value: dealerPrice, name: 'Dealer price' }
    ];
    for (const validation of priceValidations) {
      const { field, value, name } = validation;
      if (value === undefined || value === null || value === '' || isNaN(value) || Number(value) <= 0) {
        console.error(`Validation Error: Invalid ${field}`, { [field]: value, type: typeof value });
        return res.status(400).json({
          message: `${name} is required and must be a positive number`,
          received: { [field]: value, type: typeof value }
        });
      }
    }
    // Validate pricing order
    const dealerPriceNum = Number(dealerPrice);
    const architectPriceNum = Number(architectPrice);
    const generalPriceNum = Number(generalPrice);
    if (dealerPriceNum >= architectPriceNum || architectPriceNum >= generalPriceNum) {
      return res.status(400).json({
        message: 'Invalid pricing order: dealerPrice < architectPrice < generalPrice',
        received: {
          dealerPrice: dealerPriceNum,
          architectPrice: architectPriceNum,
          generalPrice: generalPriceNum
        }
      });
    }
    // Handle images (FIXED: Separate main and gallery, no dupes)
    let mainImage = null;
    let galleryImages = [];
    if (req.files && req.files.image && req.files.image[0]) {
      mainImage = req.files.image[0].filename;
    }
    if (req.files && req.files.images) {
      galleryImages = req.files.images.map(file => file.filename);
    }
    // Parse JSON fields safely
    const parsedSpecifications = safeJsonParse(specifications, {});
    const parsedVisibleTo = safeJsonParse(visibleTo, ['Residential', 'Commercial', 'Modular Kitchen', 'Others']);
    const parsedColors = safeJsonParse(colors, []);
    // Validate parsed fields
    if (parsedVisibleTo && !validateVisibleTo(parsedVisibleTo)) {
      return res.status(400).json({
        message: 'Invalid visibleTo values: must be a non-empty array',
        received: parsedVisibleTo
      });
    }
    if (parsedColors && !validateColors(parsedColors)) {
      return res.status(400).json({
        message: 'Invalid colors: must be an array of non-empty strings',
        received: parsedColors
      });
    }
    // Validate GST
    if (gst !== undefined && gst !== null && gst !== '' && (isNaN(gst) || Number(gst) < 0 || Number(gst) > 100)) {
      return res.status(400).json({
        message: 'Invalid GST: must be a number between 0 and 100',
        received: { gst, type: typeof gst }
      });
    }
    // Validate categoryId if provided
    if (categoryId && categoryId !== '' && categoryId !== 'null') {
      const exists = await Category.findByPk(categoryId);
      if (!exists) {
        return res.status(400).json({
          message: 'Invalid categoryId (category not found)',
          received: categoryId
        });
      }
    }
    // Prepare product data, prioritize subcategoryId if provided
    let finalCategoryId = null;
    if (subcategoryId && subcategoryId !== '' && subcategoryId !== 'null') {
      finalCategoryId = subcategoryId;
    } else if (categoryId && categoryId !== '' && categoryId !== 'null') {
      finalCategoryId = categoryId;
    }
    const productData = {
      name: name.trim(),
      description: description || null,
      image: mainImage,
      images: galleryImages,
      specifications: parsedSpecifications,
      visibleTo: parsedVisibleTo,
      mrpPrice: mrpPrice && mrpPrice !== '' && mrpPrice !== 'null' ? Number(mrpPrice) : null,
      generalPrice: Number(generalPrice),
      architectPrice: Number(architectPrice),
      dealerPrice: Number(dealerPrice),
      designNumber: designNumber || null,
      size: size || null,
      thickness: thickness || null,
      categoryId: finalCategoryId,
      productUsageTypeId: (productUsageTypeId && productUsageTypeId !== '' && productUsageTypeId !== 'null') ? productUsageTypeId : null,
      colors: parsedColors,
      gst: (gst && gst !== '' && gst !== 'null') ? parseFloat(gst) : null,
      brandName: brandName || null,
      unitType: unitType || null,
      averageRating: 0.00,
      totalRatings: 0,
      isActive: true
    };
    console.log('Creating product with data:', productData);
    // Create product
    const product = await Product.create(productData);
    console.log('Product created successfully:', product.id);
    // FIXED: Refetch with includes for consistent response
    const createdProduct = await Product.findByPk(product.id, {
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'parentId'],
          include: [
            { model: Category, as: 'parent', attributes: ['id', 'name'] }
          ]
        }
      ]
    });
    // Return processed product
    res.status(201).json({
      message: 'Product created successfully',
      product: processProductData(createdProduct, req)
    });
  } catch (error) {
    console.error('Create product error:', error);
   
    // Enhanced error response
    const errorResponse = {
      message: error.message || 'Failed to create product',
      debug: {
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    };
    if (error.errors) {
      errorResponse.validationErrors = error.errors.map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
    }
    res.status(400).json(errorResponse);
  }
};

const getProductByName = async (req, res) => {
  try {
    const { name } = req.params;
    const { userType } = req.query;
    const userRole = getReqUserRole(req);
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Product name is required' });
    }
    const whereClause = {
      isActive: true,
      name: { [Op.iLike]: `%${name}%` }
    };
    if (userType) {
      whereClause[Op.and] = sequelize.where(
        sequelize.literal(`visibleTo LIKE '%"${userType}"%'`),
        true
      );
    }
    const product = await Product.findOne({
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'parentId'],
          include: [
            {
              model: Category,
              as: 'parent',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const processedProduct = processProductData(product, req);
    processedProduct.price = computePrice(product, userRole);
    res.json({
      product: processedProduct,
      userType: userType || null,
      userRole
    });
  } catch (error) {
    console.error('Get product by name error:', error);
    res.status(400).json({ message: error.message });
  }
};

const searchProductsByName = async (req, res) => {
  try {
    const { name, userType, page = 1, limit = 20 } = req.query;
    const userRole = getReqUserRole(req);
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Search name is required' });
    }
    const whereClause = {
      isActive: true,
      name: { [Op.iLike]: `%${name}%` }
    };
    if (userType) {
      whereClause[Op.and] = sequelize.where(
        sequelize.literal(`visibleTo LIKE '%"${userType}"%'`),
        true
      );
    }
    const offset = (page - 1) * limit;
    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset)
    });
    const processedProducts = products.map(product => {
      const productData = processProductData(product, req);
      productData.price = computePrice(product, userRole);
      return productData;
    });
    res.json({
      products: processedProducts,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      userType: userType || null,
      userRole
    });
  } catch (error) {
    console.error('Search products by name error:', error);
    res.status(400).json({ message: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userType } = req.query;
    const userRole = getReqUserRole(req);
    const whereClause = { id, isActive: true };
    if (userType) {
      whereClause[Op.and] = sequelize.where(
        sequelize.literal(`visibleTo LIKE '%"${userType}"%'`),
        true
      );
    }
    const product = await Product.findOne({
      where: whereClause,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
    });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const processedProduct = processProductData(product, req);
    processedProduct.price = computePrice(product, userRole);
    res.json({
      product: processedProduct,
      userType: userType || null,
      userRole
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(400).json({ message: error.message });
  }
};

// HARMONIZED: updateProduct (PATCH) - Partial updates, preserves existings
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      specifications,
      categoryId,
      visibleTo,
      mrpPrice,
      generalPrice,
      architectPrice,
      dealerPrice,
      designNumber,
      size,
      thickness,
      isActive,
      colors,
      gst,
      brandName,
      unitType
    } = req.body;
    let subcategoryId = req.body.subcategoryId; // FIXED: Body only, no query
    let keptImages = [];
    if (req.body.keptImages) {
      keptImages = safeJsonParse(req.body.keptImages, []);
    }
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    // Handle images (FIXED: Separate main/gallery, cleanup old)
    const uploadDir = path.join(__dirname, '..', 'uploads', 'products');
    let finalImage = null;
    let finalImages = [...(product.images || []), ...(req.files?.images?.map(f => f.filename) || [])];
    if (req.files?.image?.[0]) {
      // New main: replace old
      if (product?.image) {
        await cleanupFiles([product.image], uploadDir);
      }
      finalImage = req.files.image[0].filename;
    } else {
      finalImage = product?.image || null;
    }
    // Cleanup removed gallery images
    const removedImages = (product?.images || []).filter(img => !keptImages.includes(img));
    if (removedImages.length > 0) {
      await cleanupFiles(removedImages, uploadDir);
    }
    finalImages = finalImages.filter(img => keptImages.includes(img) || req.files?.images?.map(f => f.filename).includes(img));
    const parsedSpecifications = safeJsonParse(specifications);
    const parsedVisibleTo = safeJsonParse(visibleTo);
    const parsedColors = safeJsonParse(colors);
    if (parsedVisibleTo !== undefined && !validateVisibleTo(parsedVisibleTo)) {
      return res.status(400).json({ message: 'Invalid visibleTo values: must be a non-empty array' });
    }
    if (parsedColors !== undefined && !validateColors(parsedColors)) {
      return res.status(400).json({ message: 'Invalid colors: must be an array of non-empty strings' });
    }
    if (gst !== undefined && (isNaN(gst) || gst < 0 || gst > 100)) {
      return res.status(400).json({ message: 'Invalid GST: must be a number between 0 and 100' });
    }
    // Validate prices if changed
    if (generalPrice !== undefined && (isNaN(generalPrice) || Number(generalPrice) <= 0)) {
      return res.status(400).json({ message: 'General price must be a positive number' });
    }
    if (architectPrice !== undefined && (isNaN(architectPrice) || Number(architectPrice) <= 0)) {
      return res.status(400).json({ message: 'Architect price must be a positive number' });
    }
    if (dealerPrice !== undefined && (isNaN(dealerPrice) || Number(dealerPrice) <= 0)) {
      return res.status(400).json({ message: 'Dealer price must be a positive number' });
    }
    const dealerPriceNum = Number(dealerPrice ?? product.dealerPrice);
    const architectPriceNum = Number(architectPrice ?? product.architectPrice);
    const generalPriceNum = Number(generalPrice ?? product.generalPrice);
    if (
      (generalPrice !== undefined || architectPrice !== undefined || dealerPrice !== undefined) &&
      (dealerPriceNum >= architectPriceNum || architectPriceNum >= generalPriceNum)
    ) {
      return res.status(400).json({ message: 'Invalid pricing: dealer < architect < general' });
    }
    // Validate categoryId if provided
    if (categoryId && categoryId !== '' && categoryId !== 'null') {
      const exists = await Category.findByPk(categoryId);
      if (!exists) {
        return res.status(400).json({ message: 'Invalid categoryId (category not found)' });
      }
    }
    // Prepare final categoryId, prioritize subcategoryId if provided
    let finalCategoryId = product.categoryId;
    if (subcategoryId !== undefined && subcategoryId !== '' && subcategoryId !== 'null') {
      finalCategoryId = subcategoryId;
    } else if (categoryId !== undefined && categoryId !== '' && categoryId !== 'null') {
      finalCategoryId = categoryId;
    }
    const updateData = {
      name: name !== undefined ? name.trim() : product.name,
      description: description !== undefined ? description : product.description,
      specifications: parsedSpecifications !== undefined ? parsedSpecifications : product.specifications,
      categoryId: finalCategoryId,
      visibleTo: parsedVisibleTo !== undefined ? parsedVisibleTo : product.visibleTo,
      mrpPrice: mrpPrice !== undefined ? (mrpPrice !== '' && mrpPrice !== 'null' ? Number(mrpPrice) : null) : product.mrpPrice,
      generalPrice: generalPrice !== undefined ? Number(generalPrice) : product.generalPrice,
      architectPrice: architectPrice !== undefined ? Number(architectPrice) : product.architectPrice,
      dealerPrice: dealerPrice !== undefined ? Number(dealerPrice) : product.dealerPrice,
      designNumber: designNumber !== undefined ? designNumber : product.designNumber,
      size: size !== undefined ? size : product.size,
      thickness: thickness !== undefined ? thickness : product.thickness,
      isActive: isActive !== undefined ? isActive : product.isActive,
      colors: parsedColors !== undefined ? parsedColors : product.colors,
      gst: gst !== undefined ? parseFloat(gst) : product.gst,
      brandName: brandName !== undefined ? brandName : product.brandName,
      unitType: unitType !== undefined ? unitType : product.unitType,
      image: finalImage,
      images: finalImages
    };
    await product.update(updateData);
    // FIXED: Refetch with includes
    const updatedProduct = await Product.findByPk(product.id, {
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'parentId'],
          include: [
            { model: Category, as: 'parent', attributes: ['id', 'name'] }
          ]
        }
      ]
    });
    res.json({
      message: 'Product updated successfully',
      product: processProductData(updatedProduct, req)
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(400).json({ message: error.message });
  }
};

// HARMONIZED: updateProductAll (PUT) - Full updates, but preserves logic from PATCH
const updateProductAll = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      specifications,
      visibleTo,
      mrpPrice,
      generalPrice,
      architectPrice,
      dealerPrice,
      designNumber,
      size,
      thickness,
      categoryId,
      productUsageTypeId,
      colors,
      gst,
      brandName,
      isActive,
      unitType
    } = req.body;
    let subcategoryId = req.body.subcategoryId; // FIXED: Body only
    let keptImages = safeJsonParse(req.body.keptImages, []);
    // Reuse image handling from updateProduct (FIXED)
    const uploadDir = path.join(__dirname, '..', 'uploads', 'products');
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    let finalImage = product.image;
    let finalImages = [...(product.images || []), ...(req.files?.images?.map(f => f.filename) || [])];
    if (req.files?.image?.[0]) {
      if (product.image) {
        await cleanupFiles([product.image], uploadDir);
      }
      finalImage = req.files.image[0].filename;
    }
    const removedImages = (product.images || []).filter(img => !keptImages.includes(img));
    if (removedImages.length > 0) {
      await cleanupFiles(removedImages, uploadDir);
    }
    finalImages = finalImages.filter(img => keptImages.includes(img) || req.files?.images?.map(f => f.filename).includes(img));
    const parsedSpecifications = safeJsonParse(specifications, {});
    const parsedVisibleTo = safeJsonParse(visibleTo, []);
    const parsedColors = safeJsonParse(colors, []);
    if (!validateVisibleTo(parsedVisibleTo)) {
      return res.status(400).json({ message: 'Invalid visibleTo values: must be a non-empty array' });
    }
    if (!validateColors(parsedColors)) {
      return res.status(400).json({ message: 'Invalid colors: must be an array of non-empty strings' });
    }
    if (gst !== undefined && (isNaN(gst) || gst < 0 || gst > 100)) {
      return res.status(400).json({ message: 'Invalid GST: must be a number between 0 and 100' });
    }
    // FULL VALIDATION: Like create
    const priceValidations = [
      { field: 'generalPrice', value: generalPrice, name: 'General price' },
      { field: 'architectPrice', value: architectPrice, name: 'Architect price' },
      { field: 'dealerPrice', value: dealerPrice, name: 'Dealer price' }
    ];
    for (const validation of priceValidations) {
      const { field, value, name } = validation;
      if (isNaN(value) || Number(value) <= 0) {
        return res.status(400).json({
          message: `${name} must be a positive number`,
          received: { [field]: value }
        });
      }
    }
    const dealerPriceNum = Number(dealerPrice);
    const architectPriceNum = Number(architectPrice);
    const generalPriceNum = Number(generalPrice);
    if (dealerPriceNum >= architectPriceNum || architectPriceNum >= generalPriceNum) {
      return res.status(400).json({ message: 'Invalid pricing: dealer < architect < general' });
    }
    if (categoryId && categoryId !== '' && categoryId !== 'null') {
      const exists = await Category.findByPk(categoryId);
      if (!exists) {
        return res.status(400).json({ message: 'Invalid categoryId (category not found)' });
      }
    }
    // Prepare final categoryId, prioritize subcategoryId if provided
    let finalCategoryId = null;
    if (subcategoryId && subcategoryId !== '' && subcategoryId !== 'null') {
      finalCategoryId = subcategoryId;
    } else if (categoryId && categoryId !== '' && categoryId !== 'null') {
      finalCategoryId = categoryId;
    }
    const updateData = {
      name: name?.trim() || product.name,
      description: description || product.description,
      specifications: parsedSpecifications,
      visibleTo: parsedVisibleTo,
      mrpPrice: mrpPrice !== undefined ? (mrpPrice !== '' && mrpPrice !== 'null' ? Number(mrpPrice) : null) : product.mrpPrice,
      generalPrice: Number(generalPrice),
      architectPrice: Number(architectPrice),
      dealerPrice: Number(dealerPrice),
      designNumber: designNumber || null,
      size: size || null,
      thickness: thickness || null,
      categoryId: finalCategoryId || product.categoryId,
      productUsageTypeId: productUsageTypeId !== undefined ? (productUsageTypeId !== '' && productUsageTypeId !== 'null' ? productUsageTypeId : null) : product.productUsageTypeId,
      colors: parsedColors,
      gst: gst !== undefined ? parseFloat(gst) : product.gst,
      brandName: brandName || null,
      isActive: isActive !== undefined ? isActive : product.isActive, // FIXED: Preserve if not provided
      unitType: unitType !== undefined ? (unitType || product.unitType) : product.unitType, // FIXED: Preserve
      image: finalImage,
      images: finalImages
    };
    await product.update(updateData);
    // FIXED: Refetch with includes
    const updatedProduct = await Product.findByPk(product.id, {
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'parentId'],
          include: [
            { model: Category, as: 'parent', attributes: ['id', 'name'] }
          ]
        }
      ]
    });
    res.json({
      message: 'Product updated successfully',
      product: processProductData(updatedProduct, req)
    });
  } catch (error) {
    console.error('Update product all error:', error);
    res.status(400).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const uploadDir = path.join(__dirname, '..', 'uploads', 'products');
    const filesToDelete = [];
    if (product.image) filesToDelete.push(product.image);
    if (product.images && Array.isArray(product.images)) {
      filesToDelete.push(...product.images);
    }
    if (filesToDelete.length > 0) {
      await cleanupFiles(filesToDelete, uploadDir);
    }
    await product.destroy();
    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(400).json({ message: error.message });
  }
};

const addProductRating = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, review } = req.body;
    const userId = req.user.id;
    if (!validateRating(rating)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    let existingRating = await ProductRating.findOne({
      where: { userId, productId, isActive: true }
    });
    if (existingRating) {
      await existingRating.update({ rating, review });
    } else {
      existingRating = await ProductRating.create({
        userId,
        productId,
        rating,
        review
      });
    }
    const allRatings = await ProductRating.findAll({
      where: { productId, isActive: true }
    });
    const totalRating = allRatings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = allRatings.length > 0 ? totalRating / allRatings.length : 0;
    await product.update({
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalRatings: allRatings.length
    });
    res.json({
      message: 'Rating added successfully',
      rating: existingRating,
      productStats: {
        averageRating: product.averageRating,
        totalRatings: product.totalRatings
      }
    });
  } catch (error) {
    console.error('Add rating error:', error);
    res.status(400).json({ message: error.message });
  }
};

const getProductRatings = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const { count, rows: ratings } = await ProductRating.findAndCountAll({
      where: { productId, isActive: true },
      include: [{ model: User, as: 'User', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset)
    });
    res.json({
      ratings,
      total: count,
      page: Number(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getProductByName,
  searchProductsByName,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductAll,
  addProductRating,
  getProductRatings
};getProductRatings

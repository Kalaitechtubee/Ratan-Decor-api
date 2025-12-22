// controllers/productController.js
const { Product, Category, ProductRating, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs').promises;

const getReqUserRole = (req) => req.user?.role || 'General';

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
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  if (filename.startsWith('/uploads/')) return filename;
  const envBaseUrl = process.env.BASE_URL?.trim();
  const baseUrl = envBaseUrl || `${req.protocol}://${req.get('host')}`;
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
      categoryId, // Can be comma-separated IDs: "1,2,3"
      subcategoryId, // Can be comma-separated IDs: "4,5,6"
      minPrice,
      maxPrice,
      search,
      page = 1,
      limit = 20,
      isActive,
      designNumber,
      minDesignNumber,
      maxDesignNumber,
      brandName, // Can be comma-separated: "Brand1,Brand2"
      colors, // Can be comma-separated: "Red,Blue,Green"
      minGst,
      maxGst,
      size, // Can be comma-separated: "12x12,24x24"
      thickness, // Can be comma-separated: "8mm,10mm"
      unitType, // Can be comma-separated: "Box,Sq.Ft"
      sortBy = 'createdAt', // createdAt, price, name, averageRating
      sortOrder = 'DESC' // ASC or DESC
    } = req.query;

    const userRole = getReqUserRole(req);
    const whereClause = {};

    // Active/Inactive filter
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

    // MULTI-SELECT CATEGORY FILTER
    if (categoryId || subcategoryId) {
      const categoryIds = [];

      // Parse main category IDs
      if (categoryId) {
        const ids = categoryId.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        categoryIds.push(...ids);
      }

      // Parse subcategory IDs
      if (subcategoryId) {
        const ids = subcategoryId.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        categoryIds.push(...ids);
      }

      // If we have any valid category IDs, filter by them
      if (categoryIds.length > 0) {
        whereClause.categoryId = { [Op.in]: categoryIds };
      }
    }

    // PRICE FILTERING based on user role
    if (minPrice || maxPrice) {
      let priceField = 'generalPrice'; // default

      if (userRole && userRole.toLowerCase() === 'dealer') {
        priceField = 'dealerPrice';
      } else if (userRole && userRole.toLowerCase() === 'architect') {
        priceField = 'architectPrice';
      }

      whereClause[priceField] = {};
      if (minPrice) {
        const minPriceNum = Number(minPrice);
        if (!isNaN(minPriceNum) && minPriceNum > 0) {
          whereClause[priceField][Op.gte] = minPriceNum;
        }
      }
      if (maxPrice) {
        const maxPriceNum = Number(maxPrice);
        if (!isNaN(maxPriceNum) && maxPriceNum > 0) {
          whereClause[priceField][Op.lte] = maxPriceNum;
        }
      }
    }

    // DESIGN NUMBER FILTERING (Number-based only)
    const designNumberConditions = [];

    // Ensure designNumber column is treated as numeric for range comparisons
    // but only if it contains numeric values
    const numericCheck = sequelize.where(
      sequelize.col('designNumber'),
      { [Op.regexp]: '^[0-9]+$' }
    );

    if (designNumber) {
      const trimmedDesign = designNumber.trim();
      if (/^\d+$/.test(trimmedDesign)) {
        // If it's a number, we can search by exact numeric match or partial but restricted to digits
        designNumberConditions.push(numericCheck);
        designNumberConditions.push(
          sequelize.where(
            sequelize.col('designNumber'),
            { [Op.like]: `%${trimmedDesign}%` }
          )
        );
      }
    }

    if (minDesignNumber || maxDesignNumber) {
      designNumberConditions.push(numericCheck);

      if (minDesignNumber) {
        const minNum = parseInt(minDesignNumber);
        if (!isNaN(minNum)) {
          designNumberConditions.push(
            sequelize.where(
              sequelize.literal('CAST(designNumber AS UNSIGNED)'),
              { [Op.gte]: minNum }
            )
          );
        }
      }

      if (maxDesignNumber) {
        const maxNum = parseInt(maxDesignNumber);
        if (!isNaN(maxNum)) {
          designNumberConditions.push(
            sequelize.where(
              sequelize.literal('CAST(designNumber AS UNSIGNED)'),
              { [Op.lte]: maxNum }
            )
          );
        }
      }
    }

    if (designNumberConditions.length > 0) {
      if (!whereClause[Op.and]) {
        whereClause[Op.and] = [];
      } else if (!Array.isArray(whereClause[Op.and])) {
        whereClause[Op.and] = [whereClause[Op.and]];
      }
      whereClause[Op.and].push(...designNumberConditions);
    }

    // MULTI-SELECT BRAND NAME FILTER
    if (brandName) {
      const brands = brandName.split(',').map(b => b.trim()).filter(b => b.length > 0);
      if (brands.length > 0) {
        whereClause.brandName = { [Op.in]: brands };
      }
    }

    // MULTI-SELECT SIZE FILTER
    if (size) {
      const sizes = size.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (sizes.length > 0) {
        whereClause.size = { [Op.in]: sizes };
      }
    }

    // MULTI-SELECT THICKNESS FILTER
    if (thickness) {
      const thicknesses = thickness.split(',').map(t => t.trim()).filter(t => t.length > 0);
      if (thicknesses.length > 0) {
        whereClause.thickness = { [Op.in]: thicknesses };
      }
    }

    // MULTI-SELECT UNIT TYPE FILTER
    if (unitType) {
      const units = unitType.split(',').map(u => u.trim()).filter(u => u.length > 0);
      if (units.length > 0) {
        whereClause.unitType = { [Op.in]: units };
      }
    }

    // GST RANGE FILTER
    if (minGst || maxGst) {
      whereClause.gst = {};
      if (minGst) {
        const min = Number(minGst);
        if (!isNaN(min) && min >= 0) {
          whereClause.gst[Op.gte] = min;
        }
      }
      if (maxGst) {
        const max = Number(maxGst);
        if (!isNaN(max) && max <= 100) {
          whereClause.gst[Op.lte] = max;
        }
      }
    }

    // MULTI-SELECT COLOR FILTER (searches within JSON array)
    if (colors) {
      const colorList = colors.split(',').map(c => c.trim()).filter(c => c.length > 0);
      if (colorList.length > 0) {
        const colorConditions = colorList.map(color =>
          sequelize.where(
            sequelize.fn('JSON_SEARCH', sequelize.col('colors'), 'one', color),
            Op.ne, null
          )
        );

        if (whereClause[Op.and]) {
          if (Array.isArray(whereClause[Op.and])) {
            whereClause[Op.and].push({ [Op.or]: colorConditions });
          } else {
            whereClause[Op.and] = [whereClause[Op.and], { [Op.or]: colorConditions }];
          }
        } else {
          whereClause[Op.and] = [{ [Op.or]: colorConditions }];
        }
      }
    }

    // SEARCH FUNCTIONALITY
    if (search) {
      const escapedSearch = search.trim().replace(/[%_\\]/g, '\\$&');
      const searchConditions = [
        { name: { [Op.like]: `%${escapedSearch}%` } },
        { description: { [Op.like]: `%${escapedSearch}%` } },
        { brandName: { [Op.like]: `%${escapedSearch}%` } },
        { designNumber: { [Op.like]: `%${escapedSearch}%` } },
        sequelize.where(
          sequelize.fn('JSON_SEARCH', sequelize.col('specifications'), 'one', `%${escapedSearch}%`),
          Op.ne, null
        )
      ];

      if (whereClause[Op.and]) {
        if (Array.isArray(whereClause[Op.and])) {
          whereClause[Op.and].push({ [Op.or]: searchConditions });
        } else {
          whereClause[Op.and] = [whereClause[Op.and], { [Op.or]: searchConditions }];
        }
      } else {
        whereClause[Op.or] = searchConditions;
      }
    }

    // SORTING
    let orderClause = [];
    const validSortFields = ['createdAt', 'name', 'averageRating', 'mrpPrice', 'generalPrice', 'architectPrice', 'dealerPrice'];
    const validSortOrders = ['ASC', 'DESC'];

    if (sortBy === 'price') {
      // Sort by price based on user role
      let priceField = 'generalPrice';
      if (userRole && userRole.toLowerCase() === 'dealer') {
        priceField = 'dealerPrice';
      } else if (userRole && userRole.toLowerCase() === 'architect') {
        priceField = 'architectPrice';
      }
      orderClause.push([priceField, validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC']);
    } else if (validSortFields.includes(sortBy)) {
      orderClause.push([sortBy, validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC']);
    } else {
      orderClause.push(['createdAt', 'DESC']);
    }

    const offset = (page - 1) * limit;

    // COUNT QUERIES
    const activeCount = await Product.count({
      where: { ...whereClause, isActive: true }
    });
    const inactiveCount = await Product.count({
      where: { ...whereClause, isActive: false }
    });
    const totalCount = activeCount + inactiveCount;

    // FETCH PRODUCTS
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
      order: orderClause,
      limit: Number(limit),
      offset: Number(offset)
    });

    // PROCESS PRODUCTS
    const processedProducts = products.map(product => {
      const productData = processProductData(product, req);
      productData.price = computePrice(product, userRole);
      return productData;
    });

    // EXTRACT UNIQUE FILTER OPTIONS from all products (for filter UI)
    const allProductsForFilters = await Product.findAll({
      attributes: ['brandName', 'size', 'thickness', 'unitType', 'colors', 'gst'],
      where: { isActive: true }
    });

    const uniqueBrands = [...new Set(allProductsForFilters.map(p => p.brandName).filter(Boolean))].sort();
    const uniqueSizes = [...new Set(allProductsForFilters.map(p => p.size).filter(Boolean))].sort();
    const uniqueThicknesses = [...new Set(allProductsForFilters.map(p => p.thickness).filter(Boolean))].sort();
    const uniqueUnitTypes = [...new Set(allProductsForFilters.map(p => p.unitType).filter(Boolean))].sort();

    // Extract unique colors from JSON arrays
    const allColors = new Set();
    allProductsForFilters.forEach(p => {
      if (p.colors && Array.isArray(p.colors)) {
        p.colors.forEach(color => allColors.add(color));
      }
    });
    const uniqueColors = [...allColors].sort();

    // GST values
    const gstValues = [...new Set(allProductsForFilters.map(p => p.gst).filter(g => g !== null))].sort((a, b) => a - b);

    res.json({
      products: processedProducts,
      count,
      totalCount,
      activeCount,
      inactiveCount,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      userRole,

      // Applied filters
      appliedFilters: {
        userType: userType || null,
        categoryIds: categoryId ? categoryId.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [],
        subcategoryIds: subcategoryId ? subcategoryId.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [],
        priceRange: {
          min: minPrice || null,
          max: maxPrice || null,
          priceField: userRole && userRole.toLowerCase() === 'dealer' ? 'dealerPrice' :
            userRole && userRole.toLowerCase() === 'architect' ? 'architectPrice' : 'generalPrice'
        },
        designNumber: designNumber || null,
        designNumberRange: {
          min: minDesignNumber || null,
          max: maxDesignNumber || null
        },
        brandNames: brandName ? brandName.split(',').map(b => b.trim()).filter(b => b.length > 0) : [],
        colors: colors ? colors.split(',').map(c => c.trim()).filter(c => c.length > 0) : [],
        sizes: size ? size.split(',').map(s => s.trim()).filter(s => s.length > 0) : [],
        thicknesses: thickness ? thickness.split(',').map(t => t.trim()).filter(t => t.length > 0) : [],
        unitTypes: unitType ? unitType.split(',').map(u => u.trim()).filter(u => u.length > 0) : [],
        gstRange: {
          min: minGst || null,
          max: maxGst || null
        },
        search: search || null,
        isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : null,
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'DESC'
      },

      // Available filter options
      availableFilters: {
        brands: uniqueBrands,
        sizes: uniqueSizes,
        thicknesses: uniqueThicknesses,
        unitTypes: uniqueUnitTypes,
        colors: uniqueColors,
        gstValues: gstValues
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(400).json({
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


const createProduct = async (req, res) => {
  try {
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

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        message: 'Product name is required and must be a non-empty string',
        received: { name, type: typeof name }
      });
    }

    const priceValidations = [
      { field: 'generalPrice', value: generalPrice, name: 'General price' },
      { field: 'architectPrice', value: architectPrice, name: 'Architect price' },
      { field: 'dealerPrice', value: dealerPrice, name: 'Dealer price' }
    ];
    for (const validation of priceValidations) {
      const { field, value, name } = validation;
      if (value === undefined || value === null || value === '' || isNaN(value) || Number(value) <= 0) {
        return res.status(400).json({
          message: `${name} is required and must be a positive number`,
          received: { [field]: value, type: typeof value }
        });
      }
    }

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

    let mainImage = null;
    let galleryImages = [];
    if (req.files && req.files.image && req.files.image[0]) {
      mainImage = req.files.image[0].filename;
    }
    if (req.files && req.files.images) {
      galleryImages = req.files.images.map(file => file.filename);
    }

    const parsedSpecifications = safeJsonParse(specifications, {});
    const parsedVisibleTo = safeJsonParse(visibleTo, ['Residential', 'Commercial', 'Modular Kitchen', 'Others']);
    const parsedColors = safeJsonParse(colors, []);

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

    if (gst !== undefined && gst !== null && gst !== '' && (isNaN(gst) || Number(gst) < 0 || Number(gst) > 100)) {
      return res.status(400).json({
        message: 'Invalid GST: must be a number between 0 and 100',
        received: { gst, type: typeof gst }
      });
    }

    if (categoryId && categoryId !== '' && categoryId !== 'null') {
      const exists = await Category.findByPk(categoryId);
      if (!exists) {
        return res.status(400).json({
          message: 'Invalid categoryId (category not found)',
          received: categoryId
        });
      }
    }

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

    const product = await Product.create(productData);

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

    res.status(201).json({
      message: 'Product created successfully',
      product: processProductData(createdProduct, req)
    });
  } catch (error) {
    console.error('Create product error:', error);

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
    let subcategoryId = req.body.subcategoryId;
    let keptImages = [];
    if (req.body.keptImages) {
      keptImages = safeJsonParse(req.body.keptImages, []);
    }
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const uploadDir = path.join(__dirname, '..', 'uploads', 'products');
    let finalImage = null;
    let finalImages = [...(product.images || []), ...(req.files?.images?.map(f => f.filename) || [])];
    if (req.files?.image?.[0]) {
      if (product?.image) {
        await cleanupFiles([product.image], uploadDir);
      }
      finalImage = req.files.image[0].filename;
    } else {
      finalImage = product?.image || null;
    }
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
    if (categoryId && categoryId !== '' && categoryId !== 'null') {
      const exists = await Category.findByPk(categoryId);
      if (!exists) {
        return res.status(400).json({ message: 'Invalid categoryId (category not found)' });
      }
    }
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
    let subcategoryId = req.body.subcategoryId;
    let keptImages = safeJsonParse(req.body.keptImages, []);

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
      isActive: isActive !== undefined ? isActive : product.isActive,
      unitType: unitType !== undefined ? (unitType || product.unitType) : product.unitType,
      image: finalImage,
      images: finalImages
    };
    await product.update(updateData);

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
};
// product/productController.js
const { Product, Category, ProductRating, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const allowedUserTypes = ['Residential', 'Commercial', 'Modular Kitchen', 'Others'];

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

const computePrice = (product, role) =>
  role === 'Dealer'
    ? product.dealerPrice
    : role === 'Architect'
    ? product.architectPrice
    : product.generalPrice;

const validateVisibleTo = (visibleTo) => {
  if (!Array.isArray(visibleTo) || visibleTo.length === 0) return false;
  return visibleTo.every(v => allowedUserTypes.includes(v));
};

const getImageUrl = (filename, req) => {
  if (!filename) return null;
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  if (filename.startsWith('/uploads/')) return filename;
  const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
  return `${baseUrl}/uploads/products/${filename}`;
};

// Update processProductData function to handle multiple images
const processProductData = (product, req) => {
  const productData = product.toJSON ? product.toJSON() : product;
  
  // Handle single image
  if (productData.image) {
    productData.imageUrl = getImageUrl(productData.image, req);
  }
  
  // Handle multiple images
  if (productData.images && Array.isArray(productData.images)) {
    productData.imageUrls = productData.images.map(img => getImageUrl(img, req));
  }
  
  return productData;
};

// Add rating validation function
const validateRating = (rating) => {
  const numRating = Number(rating);
  return !isNaN(numRating) && numRating >= 1 && numRating <= 5;
};

const getProducts = async (req, res) => {
  try {
    const { userType, categoryId, subcategoryId, minPrice, maxPrice, search, page = 1, limit = 20 } = req.query;
    const userRole = getReqUserRole(req);

    if (!userType || !allowedUserTypes.includes(userType)) {
      return res.status(400).json({
        message: 'userType is required and must be one of: Residential, Commercial, Modular Kitchen, Others'
      });
    }

    const whereClause = {
      isActive: true,
      [Op.and]: sequelize.where(
        sequelize.literal(`JSON_CONTAINS(visibleTo, '"${userType}"')`),
        true
      )
    };

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    if (subcategoryId) {
      whereClause.categoryId = subcategoryId; // Subcategories are stored as categories with a parentId
    }

    if (minPrice || maxPrice) {
      whereClause.generalPrice = {};
      if (minPrice) whereClause.generalPrice[Op.gte] = Number(minPrice);
      if (maxPrice) whereClause.generalPrice[Op.lte] = Number(maxPrice);
    }

    if (search) {
      whereClause.name = { [Op.like]: `%${search}%` };
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
      count: processedProducts.length,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      userType,
      userRole
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(400).json({ message: error.message });
  }
};
// Create product
// Validate colors
const validateColors = (colors) => {
  if (!Array.isArray(colors)) return false;
  return colors.every(color => typeof color === 'string' && color.trim().length > 0);
};

// Create product
const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      specifications,
      visibleTo,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId,
      productUsageTypeId,
      colors,
      gst
    } = req.body;

    // Handle single image from 'image' field
    let imageFilename = req.files && req.files.image ? req.files.image[0].filename : null;
    
    // Handle multiple images from 'images' field
    let imageFilenames = req.files && req.files.images ? req.files.images.map(file => file.filename) : [];

    let parsedSpecifications = specifications;
    if (typeof specifications === 'string') {
      try {
        parsedSpecifications = JSON.parse(specifications);
      } catch {
        parsedSpecifications = {};
      }
    }

    let parsedVisibleTo = visibleTo;
    if (typeof visibleTo === 'string') {
      try {
        parsedVisibleTo = JSON.parse(visibleTo);
      } catch {
        parsedVisibleTo = allowedUserTypes;
      }
    }

    let parsedColors = colors;
    if (typeof colors === 'string') {
      try {
        parsedColors = JSON.parse(colors);
      } catch {
        parsedColors = [];
      }
    }

    if (!validateVisibleTo(parsedVisibleTo)) {
      return res.status(400).json({ message: 'Invalid visibleTo values' });
    }

    if (parsedColors && !validateColors(parsedColors)) {
      return res.status(400).json({ message: 'Invalid colors: must be an array of non-empty strings' });
    }

    if (gst !== undefined && (isNaN(gst) || gst < 0 || gst > 100)) {
      return res.status(400).json({ message: 'Invalid GST: must be a number between 0 and 100' });
    }

    if (dealerPrice >= architectPrice || architectPrice >= generalPrice) {
      return res.status(400).json({ message: 'Invalid pricing order: dealer < architect < general' });
    }

    if (categoryId) {
      const exists = await Category.findByPk(categoryId);
      if (!exists) {
        return res.status(400).json({ message: 'Invalid categoryId (category not found)' });
      }
    }

    const product = await Product.create({
      name,
      description,
      image: imageFilename,
      images: imageFilenames.length > 0 ? imageFilenames : [],
      specifications: parsedSpecifications,
      visibleTo: parsedVisibleTo,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId,
      productUsageTypeId,
      colors: parsedColors,
      gst: gst !== undefined ? parseFloat(gst) : 0.00,
      averageRating: 0.00,
      totalRatings: 0,
      isActive: true
    });

    res.status(201).json({
      message: 'Product created successfully',
      product: processProductData(product, req)
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(400).json({ message: error.message });
  }
};



// Get product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userType } = req.query;
    const userRole = getReqUserRole(req);

    if (!userType || !allowedUserTypes.includes(userType)) {
      return res.status(400).json({
        message: 'userType is required and must be one of: Residential, Commercial, Modular Kitchen, Others'
      });
    }

    const product = await Product.findOne({
      where: {
        id,
        isActive: true,
        [Op.and]: sequelize.where(
          sequelize.literal(`JSON_CONTAINS(visibleTo, '"${userType}"')`),
          true
        )
      },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const processedProduct = processProductData(product, req);
    processedProduct.price = computePrice(product, userRole);

    res.json({
      product: processedProduct,
      userType,
      userRole
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      specifications,
      categoryId,
      visibleTo,
      generalPrice,
      architectPrice,
      dealerPrice,
      isActive,
      colors,
      gst
    } = req.body;

    // Handle single image from 'image' field
    let imageFilename = req.files && req.files.image ? req.files.image[0].filename : null;
    
    // Handle multiple images from 'images' field
    let imageFilenames = req.files && req.files.images ? req.files.images.map(file => file.filename) : [];

    let parsedSpecifications = specifications;
    if (typeof specifications === 'string') {
      try {
        parsedSpecifications = JSON.parse(specifications);
      } catch {
        parsedSpecifications = {};
      }
    }

    let parsedVisibleTo = visibleTo;
    if (typeof visibleTo === 'string') {
      try {
        parsedVisibleTo = JSON.parse(visibleTo);
      } catch {
        parsedVisibleTo = allowedUserTypes;
      }
    }

    let parsedColors = colors;
    if (typeof colors === 'string') {
      try {
        parsedColors = JSON.parse(colors);
      } catch {
        parsedColors = [];
      }
    }

    if (parsedVisibleTo && !validateVisibleTo(parsedVisibleTo)) {
      return res.status(400).json({ message: 'Invalid visibleTo values' });
    }

    if (parsedColors && !validateColors(parsedColors)) {
      return res.status(400).json({ message: 'Invalid colors: must be an array of non-empty strings' });
    }

    if (gst !== undefined && (isNaN(gst) || gst < 0 || gst > 100)) {
      return res.status(400).json({ message: 'Invalid GST: must be a number between 0 and 100' });
    }

    if (
      dealerPrice !== undefined &&
      architectPrice !== undefined &&
      generalPrice !== undefined &&
      (dealerPrice >= architectPrice || architectPrice >= generalPrice)
    ) {
      return res.status(400).json({ message: 'Invalid pricing: dealer < architect < general' });
    }

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Handle old image cleanup for single image
    if (req.file && product.image) {
      const oldImagePath = path.join(__dirname, '..', 'uploads', 'products', product.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Handle old images cleanup for multiple images
    if (req.files && product.images && Array.isArray(product.images)) {
      product.images.forEach(oldImage => {
        const oldImagePath = path.join(__dirname, '..', 'uploads', 'products', oldImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      });
    }

    const updateData = {
      name,
      description,
      specifications: parsedSpecifications,
      categoryId,
      visibleTo: parsedVisibleTo,
      generalPrice,
      architectPrice,
      dealerPrice,
      isActive,
      colors: parsedColors,
      gst: gst !== undefined ? parseFloat(gst) : product.gst
    };

    if (imageFilename) {
      updateData.image = imageFilename;
    }

    if (imageFilenames.length > 0) {
      updateData.images = imageFilenames;
    }

    await product.update(updateData);

    res.json({
      message: 'Product updated successfully',
      product: processProductData(product, req)
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(400).json({ message: error.message });
  }
};
// Delete product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (product.image) {
      const imagePath = path.join(__dirname, '..', 'uploads', 'products', product.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await product.destroy();
    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Add function to add/update product rating
const addProductRating = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, review } = req.body;
    const userId = req.user.id; // From auth middleware

    // Validate rating
    if (!validateRating(rating)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user already rated this product
    let existingRating = await ProductRating.findOne({
      where: { userId, productId, isActive: true }
    });

    if (existingRating) {
      // Update existing rating
      await existingRating.update({ rating, review });
    } else {
      // Create new rating
      existingRating = await ProductRating.create({
        userId,
        productId,
        rating,
        review
      });
    }

    // Recalculate product average rating
    const allRatings = await ProductRating.findAll({
      where: { productId, isActive: true }
    });

    const totalRating = allRatings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / allRatings.length;

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

// Add function to get product ratings
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
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductRating,    // Add this
  getProductRatings    // Add this
};
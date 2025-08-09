const { Product, Category } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// Allowed values for visibleTo
const allowedUserTypes = ['Residential', 'Commercial', 'Modular Kitchen', 'Others'];

// Extract user role from JWT
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

// Compute price based on user role
const computePrice = (product, role) =>
  role === 'Dealer'
    ? product.dealerPrice
    : role === 'Architect'
    ? product.architectPrice
    : product.generalPrice;

// Validate visibleTo array
const validateVisibleTo = (visibleTo) => {
  if (!Array.isArray(visibleTo) || visibleTo.length === 0) return false;
  return visibleTo.every(v => allowedUserTypes.includes(v));
};

// Generate full image URL
const getImageUrl = (filename, req) => {
  if (!filename) return null;
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  if (filename.startsWith('/uploads/')) return filename;
  const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
  return `${baseUrl}/uploads/products/${filename}`;
};

// Convert Sequelize object to plain JSON and add imageUrl
const processProductData = (product, req) => {
  const productData = product.toJSON ? product.toJSON() : product;
  if (productData.image) {
    productData.imageUrl = getImageUrl(productData.image, req);
  }
  return productData;
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
      productUsageTypeId
    } = req.body;

    let imageFilename = req.file ? req.file.filename : null;

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

    if (!validateVisibleTo(parsedVisibleTo)) {
      return res.status(400).json({ message: 'Invalid visibleTo values' });
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
      specifications: parsedSpecifications,
      visibleTo: parsedVisibleTo,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId,
      productUsageTypeId,
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

// Get all products
const getProducts = async (req, res) => {
  try {
    const { userType, categoryId, minPrice, maxPrice, search } = req.query;
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

    if (minPrice || maxPrice) {
      whereClause.generalPrice = {};
      if (minPrice) whereClause.generalPrice[Op.gte] = Number(minPrice);
      if (maxPrice) whereClause.generalPrice[Op.lte] = Number(maxPrice);
    }

    if (search) {
      whereClause.name = { [Op.like]: `%${search}%` };
    }

    const products = await Product.findAll({
      where: whereClause,
      include: [{ model: Category, as: 'Category', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });

    const processedProducts = products.map(product => {
      const productData = processProductData(product, req);
      productData.price = computePrice(product, userRole);
      return productData;
    });

    res.json({
      products: processedProducts,
      count: processedProducts.length,
      userType,
      userRole
    });
  } catch (error) {
    console.error('Get products error:', error);
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
      include: [{ model: Category, as: 'Category', attributes: ['id', 'name'] }]
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
      isActive
    } = req.body;

    let imageFilename = req.file ? req.file.filename : null;

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

    if (parsedVisibleTo && !validateVisibleTo(parsedVisibleTo)) {
      return res.status(400).json({ message: 'Invalid visibleTo values' });
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

    if (req.file && product.image) {
      const oldImagePath = path.join(__dirname, '..', 'uploads', 'products', product.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
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
      isActive
    };

    if (imageFilename) {
      updateData.image = imageFilename;
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

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct
};

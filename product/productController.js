const { Product, Category } = require('../models');
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
  role === 'Dealer' ? product.dealerPrice :
  role === 'Architect' ? product.architectPrice :
  product.generalPrice;

const validateVisibleTo = (visibleTo) => {
  if (!Array.isArray(visibleTo) || visibleTo.length === 0) return false;
  return visibleTo.every(v => allowedUserTypes.includes(v));
};

// Helper function to get image URL
const getImageUrl = (filename) => {
  if (!filename) return null;
  return `/uploads/products/${filename}`;
};

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

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = getImageUrl(req.file.filename);
    }

    // Parse specifications if it's a string
    let parsedSpecifications = specifications;
    if (typeof specifications === 'string') {
      try {
        parsedSpecifications = JSON.parse(specifications);
      } catch (e) {
        parsedSpecifications = {};
      }
    }

    // Parse visibleTo if it's a string
    let parsedVisibleTo = visibleTo;
    if (typeof visibleTo === 'string') {
      try {
        parsedVisibleTo = JSON.parse(visibleTo);
      } catch (e) {
        parsedVisibleTo = ['Residential', 'Commercial', 'Modular Kitchen', 'Others'];
      }
    }

    if (!validateVisibleTo(parsedVisibleTo)) {
      return res.status(400).json({ message: 'Invalid visibleTo values' });
    }

    if (
      dealerPrice >= architectPrice ||
      architectPrice >= generalPrice
    ) {
      return res.status(400).json({
        message: 'Invalid pricing order: dealer < architect < general'
      });
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
      image: imageUrl,
      specifications: parsedSpecifications,
      visibleTo: parsedVisibleTo,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId,
      productUsageTypeId,
      isActive: true
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getProducts = async (req, res) => {
  try {
    const { categoryId, userType, minPrice, maxPrice, search } = req.query;

    if (!allowedUserTypes.includes(userType)) {
      return res.status(400).json({ error: 'Invalid or missing userType' });
    }

    const where = {
      isActive: true
    };

    // Fix: Use MySQL JSON_CONTAINS function instead of Op.contains
    where.visibleTo = {
      [Op.and]: [
        { [Op.ne]: null },
        sequelize.literal(`JSON_CONTAINS(visibleTo, '"${userType}"')`)
      ]
    };

    if (categoryId) where.categoryId = categoryId;
    if (minPrice) where.generalPrice = { [Op.gte]: minPrice };
    if (maxPrice) where.generalPrice = { ...(where.generalPrice || {}), [Op.lte]: maxPrice };
    if (search) where.name = { [Op.like]: `%${search}%` };

    const products = await Product.findAll({ 
      where, 
      include: [Category] 
    });

    const role = getReqUserRole(req);
    const formatted = products.map((product) => ({
      ...product.toJSON(),
      price: computePrice(product, role)
    }));

    res.json(formatted);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userType } = req.query;

    if (!allowedUserTypes.includes(userType)) {
      return res.status(400).json({ error: 'Invalid or missing userType' });
    }

    const product = await Product.findOne({
      where: {
        id,
        isActive: true,
        visibleTo: {
          [Op.and]: [
            { [Op.ne]: null },
            sequelize.literal(`JSON_CONTAINS(visibleTo, '"${userType}"')`)
          ]
        }
      },
      include: [Category]
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found for this userType' });
    }

    const role = getReqUserRole(req);
    const data = {
      ...product.toJSON(),
      price: computePrice(product, role)
    };

    res.json(data);
  } catch (error) {
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
      generalPrice,
      architectPrice,
      dealerPrice,
      isActive
    } = req.body;

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = getImageUrl(req.file.filename);
    }

    // Parse specifications if it's a string
    let parsedSpecifications = specifications;
    if (typeof specifications === 'string') {
      try {
        parsedSpecifications = JSON.parse(specifications);
      } catch (e) {
        parsedSpecifications = {};
      }
    }

    // Parse visibleTo if it's a string
    let parsedVisibleTo = visibleTo;
    if (typeof visibleTo === 'string') {
      try {
        parsedVisibleTo = JSON.parse(visibleTo);
      } catch (e) {
        parsedVisibleTo = ['Residential', 'Commercial', 'Modular Kitchen', 'Others'];
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
      return res.status(400).json({
        message: 'Invalid pricing: dealer < architect < general'
      });
    }

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Delete old image if new image is uploaded
    if (req.file && product.image) {
      const oldImagePath = path.join(__dirname, '..', product.image);
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

    // Only update image if new file is uploaded
    if (imageUrl) {
      updateData.image = imageUrl;
    }

    await product.update(updateData);

    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Delete associated image
    if (product.image) {
      const imagePath = path.join(__dirname, '..', product.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await product.destroy();
    res.json({ message: 'Product deleted' });
  } catch (error) {
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
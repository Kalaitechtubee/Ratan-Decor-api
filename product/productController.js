const { Product, Category } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database'); // Add this line
const jwt = require('jsonwebtoken');

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

const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      image,
      specifications,
      visibleTo,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId,
      productUsageTypeId
    } = req.body;

    if (!validateVisibleTo(visibleTo)) {
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
      image,
      specifications,
      visibleTo,
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
      image,
      specifications,
      categoryId,
      visibleTo,
      generalPrice,
      architectPrice,
      dealerPrice,
      isActive
    } = req.body;

    if (visibleTo && !validateVisibleTo(visibleTo)) {
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

    await product.update({
      name,
      description,
      image,
      specifications,
      categoryId,
      visibleTo,
      generalPrice,
      architectPrice,
      dealerPrice,
      isActive
    });

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
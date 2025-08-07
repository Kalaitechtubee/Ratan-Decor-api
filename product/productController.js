// const { Product, Category } = require('../models');
// const { Op } = require('sequelize');

// const createProduct = async (req, res) => {
//   try {
//     const { name, description, image, specifications, categoryId, visibleTo, generalPrice, architectPrice, dealerPrice } = req.body;
//     if (dealerPrice >= architectPrice || architectPrice >= generalPrice) {
//       return res.status(400).json({ message: 'Invalid pricing: dealer < architect < general' });
//     }
//     const product = await Product.create({
//       name, description, image, specifications, categoryId, visibleTo, 
//       generalPrice, architectPrice, dealerPrice
//     });
//     res.status(201).json(product);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

// const getProducts = async (req, res) => {
//   try {
//     const { categoryId, userType, minPrice, maxPrice, search } = req.query;
//     const where = {};
//     if (categoryId) where.categoryId = categoryId;
//     if (userType) where.visibleTo = { [Op.contains]: [userType] };
//     if (minPrice) where.generalPrice = { [Op.gte]: minPrice };
//     if (maxPrice) where.generalPrice = { [Op.lte]: maxPrice };
//     if (search) where.name = { [Op.like]: `%${search}%` };

//     const products = await Product.findAll({ where, include: [Category] });
//     const userRole = req.user?.role || 'General';
//     const formattedProducts = products.map(product => ({
//       ...product.toJSON(),
//       price: userRole === 'Dealer' ? product.dealerPrice :
//              userRole === 'Architect' ? product.architectPrice :
//              product.generalPrice
//     }));
//     res.json(formattedProducts);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

// const updateProduct = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, description, image, specifications, categoryId, visibleTo, generalPrice, architectPrice, dealerPrice } = req.body;
//     if (dealerPrice >= architectPrice || architectPrice >= generalPrice) {
//       return res.status(400).json({ message: 'Invalid pricing: dealer < architect < general' });
//     }
//     const product = await Product.findByPk(id);
//     if (!product) return res.status(404).json({ message: 'Product not found' });
//     await product.update({ name, description, image, specifications, categoryId, visibleTo, generalPrice, architectPrice, dealerPrice });
//     res.json(product);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

// const deleteProduct = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const product = await Product.findByPk(id);
//     if (!product) return res.status(404).json({ message: 'Product not found' });
//     await product.destroy();
//     res.json({ message: 'Product deleted' });
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

// module.exports = { createProduct, getProducts, updateProduct, deleteProduct };
const { Product } = require("../models");

const createProduct = async (req, res) => {
  try {
    const {
      name, description, image, specifications, visibleTo,
      basePrice, generalPrice, architectPrice, dealerPrice, categoryId
    } = req.body;

    if (!basePrice || !generalPrice || !architectPrice || !dealerPrice) {
      return res.status(400).json({ message: 'All pricing fields are required.' });
    }

    if (dealerPrice >= architectPrice || architectPrice >= generalPrice || generalPrice > basePrice) {
      return res.status(400).json({
        message: 'Invalid pricing order: dealer < architect < general < basePrice'
      });
    }

    const product = await Product.create({
      name,
      description,
      image,
      specifications,
      visibleTo,
      basePrice,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


const getProducts = async (req, res) => {
  try {
    const { categoryId, userType, minPrice, maxPrice, search } = req.query;
    const where = {};

    if (categoryId) where.categoryId = categoryId;
    if (userType) where.visibleTo = { [Op.contains]: [userType] };
    if (minPrice) where.generalPrice = { [Op.gte]: minPrice };
    if (maxPrice) where.generalPrice = { [Op.lte]: maxPrice };
    if (search) where.name = { [Op.like]: `%${search}%` };

    const products = await Product.findAll({ where, include: [Category] });

    // No login role – always return general price
    const formatted = products.map((product) => ({
      ...product.toJSON(),
      price: product.generalPrice
    }));

    res.json(formatted);
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
      dealerPrice
    } = req.body;

    if (dealerPrice >= architectPrice || architectPrice >= generalPrice) {
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
      dealerPrice
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
  updateProduct,
  deleteProduct
};

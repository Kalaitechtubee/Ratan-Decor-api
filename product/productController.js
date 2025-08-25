// productController.js
const { Product, Category, ProductRating, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

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
  return true;
};

const getImageUrl = (filename, req) => {
  if (!filename || typeof filename !== 'string') return null;
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  if (filename.startsWith('/uploads/')) return filename;
  const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
  return `${baseUrl}/uploads/products/${filename}`;
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

const getProducts = async (req, res) => {
  try {
    const { userType, categoryId, subcategoryId, minPrice, maxPrice, search, page = 1, limit = 20 } = req.query;
    const userRole = getReqUserRole(req);

    const whereClause = { isActive: true };

    if (userType) {
      whereClause[Op.and] = sequelize.where(
        sequelize.literal(`JSON_CONTAINS(visibleTo, '"${userType}"')`),
        true
      );
    }

    if (categoryId) whereClause.categoryId = categoryId;
    if (subcategoryId) whereClause.categoryId = subcategoryId;

    if (minPrice || maxPrice) {
      whereClause.generalPrice = {};
      if (minPrice) whereClause.generalPrice[Op.gte] = Number(minPrice);
      if (maxPrice) whereClause.generalPrice[Op.lte] = Number(maxPrice);
    }

    if (search) {
      const searchTerms = search.trim().split(/\s+/);
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { brandName: { [Op.iLike]: `%${search}%` } },
        { designNumber: { [Op.iLike]: `%${search}%` } },
        sequelize.where(
          sequelize.fn('JSON_CONTAINS', sequelize.col('specifications'), sequelize.literal(`"${search}"`)),
          true
        )
      ];
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
    console.error('Get products error:', error);
    res.status(400).json({ message: error.message });
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
        sequelize.literal(`JSON_CONTAINS(visibleTo, '"${userType}"')`),
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
        sequelize.literal(`JSON_CONTAINS(visibleTo, '"${userType}"')`),
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
      brandName
    } = req.body;

    let imageFilenames = [];
    if (req.files && req.files.image && req.files.image[0]) {
      imageFilenames.push(req.files.image[0].filename);
    }
    if (req.files && req.files.images) {
      imageFilenames = [...imageFilenames, ...req.files.images.map(file => file.filename)];
    }

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
        parsedVisibleTo = [];
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
      return res.status(400).json({ message: 'Invalid visibleTo values: must be a non-empty array' });
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

    const productData = {
      name,
      description,
      image: null,
      images: imageFilenames,
      specifications: parsedSpecifications,
      visibleTo: parsedVisibleTo || [],
      mrpPrice,
      generalPrice,
      architectPrice,
      dealerPrice,
      designNumber: designNumber || null,
      size: size || null,
      thickness: thickness || null,
      categoryId,
      productUsageTypeId,
      colors: parsedColors,
      gst: gst !== undefined ? parseFloat(gst) : null,
      brandName: brandName || null,
      averageRating: 0.00,
      totalRatings: 0,
      isActive: true
    };

    const product = await Product.create(productData);

    res.status(201).json({
      message: 'Product created successfully',
      product: processProductData(product, req)
    });
  } catch (error) {
    console.error('Create product error:', error);
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
        sequelize.literal(`JSON_CONTAINS(visibleTo, '"${userType}"')`),
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
      brandName
    } = req.body;

    let keptImages = [];
    if (req.body.keptImages) {
      try {
        keptImages = JSON.parse(req.body.keptImages);
      } catch {
        keptImages = [];
      }
    }

    let newImageFilenames = [];
    if (req.files && req.files.image && req.files.image[0]) {
      newImageFilenames.push(req.files.image[0].filename);
    }
    if (req.files && req.files.images) {
      newImageFilenames = [...newImageFilenames, ...req.files.images.map(file => file.filename)];
    }

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
        parsedVisibleTo = [];
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
      return res.status(400).json({ message: 'Invalid visibleTo values: must be a non-empty array' });
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

    const removedImages = product.images ? product.images.filter(img => !keptImages.includes(img)) : [];
    removedImages.forEach(oldImage => {
      const oldImagePath = path.join(__dirname, '..', 'uploads', 'products', oldImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    });

    if (product.image && !keptImages.includes(product.image)) {
      const oldImagePath = path.join(__dirname, '..', 'uploads', 'products', product.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    const updateData = {
      name: name !== undefined ? name : product.name,
      description: description !== undefined ? description : product.description,
      specifications: parsedSpecifications !== undefined ? parsedSpecifications : product.specifications,
      categoryId: categoryId !== undefined ? categoryId : product.categoryId,
      visibleTo: parsedVisibleTo !== undefined ? parsedVisibleTo : product.visibleTo,
      mrpPrice: mrpPrice !== undefined ? mrpPrice : product.mrpPrice,
      generalPrice: generalPrice !== undefined ? generalPrice : product.generalPrice,
      architectPrice: architectPrice !== undefined ? architectPrice : product.architectPrice,
      dealerPrice: dealerPrice !== undefined ? dealerPrice : product.dealerPrice,
      designNumber: designNumber !== undefined ? designNumber : product.designNumber,
      size: size !== undefined ? size : product.size,
      thickness: thickness !== undefined ? thickness : product.thickness,
      isActive: isActive !== undefined ? isActive : product.isActive,
      colors: parsedColors !== undefined ? parsedColors : product.colors,
      gst: gst !== undefined ? parseFloat(gst) : product.gst,
      brandName: brandName !== undefined ? brandName : product.brandName,
      image: null,
      images: [...keptImages, ...newImageFilenames]
    };

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
      isActive
    } = req.body;

    let keptImages = [];
    if (req.body.keptImages) {
      try {
        keptImages = JSON.parse(req.body.keptImages);
      } catch {
        keptImages = [];
      }
    }

    let newImageFilenames = [];
    if (req.files && req.files.image && req.files.image[0]) {
      newImageFilenames.push(req.files.image[0].filename);
    }
    if (req.files && req.files.images) {
      newImageFilenames = [...newImageFilenames, ...req.files.images.map(file => file.filename)];
    }

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
        parsedVisibleTo = [];
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
      return res.status(400).json({ message: 'Invalid visibleTo values: must be a non-empty array' });
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

    if (categoryId) {
      const exists = await Category.findByPk(categoryId);
      if (!exists) {
        return res.status(400).json({ message: 'Invalid categoryId (category not found)' });
      }
    }

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const removedImages = product.images ? product.images.filter(img => !keptImages.includes(img)) : [];
    removedImages.forEach(oldImage => {
      const oldImagePath = path.join(__dirname, '..', 'uploads', 'products', oldImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    });

    if (product.image && !keptImages.includes(product.image)) {
      const oldImagePath = path.join(__dirname, '..', 'uploads', 'products', product.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    const updateData = {
      name,
      description,
      specifications: parsedSpecifications,
      visibleTo: parsedVisibleTo || [],
      mrpPrice,
      generalPrice,
      architectPrice,
      dealerPrice,
      designNumber: designNumber || null,
      size: size || null,
      thickness: thickness || null,
      categoryId,
      productUsageTypeId,
      colors: parsedColors,
      gst: gst !== undefined ? parseFloat(gst) : null,
      brandName: brandName || null,
      isActive: isActive !== undefined ? isActive : true,
      image: null,
      images: [...keptImages, ...newImageFilenames]
    };

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

    if (product.images && Array.isArray(product.images)) {
      product.images.forEach(image => {
        const imagePath = path.join(__dirname, '..', 'uploads', 'products', image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });
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
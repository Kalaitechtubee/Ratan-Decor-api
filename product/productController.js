// Get Products by Usage Type
exports.getProductsByUsageType = async (req, res) => {
  try {
    const { usageType } = req.params;
    const { customerType } = req.query;

    const usage = await ProductUsageType.findOne({
      where: { slug: usageType.toLowerCase() }
    });

    if (!usage) {
      return res.status(404).json({ error: 'Usage type not found' });
    }

    const products = await Product.findAll({
      where: {
        productUsageTypeId: usage.id,
        isVisible: true
      },
      include: [
        { model: ProductUsageType, as: "ProductUsageType" },
        { model: Category, required: false },
        { model: Subcategory, required: false },
      ],
    });

    const data = products.map((product) => {
      let price;
      switch ((customerType || '').toLowerCase()) {
        case 'architect':
          price = product.architectPrice || product.basePrice * 0.9;
          break;
        case 'dealer':
          price = product.dealerPrice || product.basePrice * 0.85;
          break;
        case 'general':
        default:
          price = product.generalPrice || product.basePrice;
      }
      return {
        id: product.id,
        title: product.title,
        description: product.description,
        imageUrl: product.imageUrl,
        attributes: product.attributes,
        price,
        basePrice: product.basePrice,
        usageType: product.ProductUsageType?.typeName,
        category: product.Category?.name,
        subcategory: product.Subcategory?.name,
        isVisible: product.isVisible,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ...existing code...
// backend/product/controller.js
const Product = require('./models');
const CustomerType = require('../customerType/models');
const ProductUsageType = require('../productUsageType/models');
const Category = require('../category/models');
const Subcategory = require('../subcategory/models');

// Create Product
exports.createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      imageUrl,
      attributes,
      basePrice,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId,
      subcategoryId,
      productUsageTypeId, // Required
    } = req.body;

    // Validate productUsageTypeId exists
    const usageType = await ProductUsageType.findByPk(productUsageTypeId);
    if (!usageType) {
      return res.status(400).json({ error: 'Invalid productUsageTypeId: referenced usage type does not exist.' });
    }

    const product = await Product.create({
      title,
      description,
      imageUrl,
      attributes,
      basePrice,
      generalPrice: generalPrice || basePrice,
      architectPrice: architectPrice || basePrice * 0.9, // 10% discount
      dealerPrice: dealerPrice || basePrice * 0.85, // 15% discount
      categoryId,
      subcategoryId,
      productUsageTypeId,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get All Products with customer-type-based pricing
exports.getAllProducts = async (req, res) => {
  try {
    const { customerType, usageType } = req.query;

    let whereClause = { isVisible: true };
    
    // Filter by usage type if provided
    if (usageType) {
      const usage = await ProductUsageType.findOne({ 
        where: { slug: usageType.toLowerCase() } 
      });
      if (usage) {
        whereClause.productUsageTypeId = usage.id;
      }
    }

    const products = await Product.findAll({
      where: whereClause,
      include: [
        { model: ProductUsageType, as: "ProductUsageType" },
        { model: Category, required: false },
        { model: Subcategory, required: false },
      ],
    });

    const data = products.map((product) => {
      let price;

      // Determine price based on customer type
      switch ((customerType || '').toLowerCase()) {
        case 'architect':
          price = product.architectPrice || product.basePrice * 0.9;
          break;
        case 'dealer':
          price = product.dealerPrice || product.basePrice * 0.85;
          break;
        case 'general':
        default:
          price = product.generalPrice || product.basePrice;
      }

      return {
        id: product.id,
        title: product.title,
        description: product.description,
        imageUrl: product.imageUrl,
        attributes: product.attributes,
        price,
        basePrice: product.basePrice,
        usageType: product.ProductUsageType?.typeName,
        category: product.Category?.name,
        subcategory: product.Subcategory?.name,
        isVisible: product.isVisible,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Product by ID with customer-type-based pricing
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerType } = req.query;

    const product = await Product.findByPk(id, {
      include: [
        { model: ProductUsageType, as: "ProductUsageType" },
        { model: Category, required: false },
        { model: Subcategory, required: false },
      ],
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let price;

    // Determine price based on customer type
    switch ((customerType || '').toLowerCase()) {
      case 'architect':
        price = product.architectPrice || product.basePrice * 0.9;
        break;
      case 'dealer':
        price = product.dealerPrice || product.basePrice * 0.85;
        break;
      case 'general':
      default:
        price = product.generalPrice || product.basePrice;
    }

    res.status(200).json({
      id: product.id,
      title: product.title,
      description: product.description,
      imageUrl: product.imageUrl,
      attributes: product.attributes,
      price,
      basePrice: product.basePrice,
      usageType: product.ProductUsageType?.typeName,
      category: product.Category?.name,
      subcategory: product.Subcategory?.name,
      isVisible: product.isVisible,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ...existing code...

// Update Product
exports.updateProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      imageUrl,
      attributes,
      isVisible,
      basePrice,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId,
      subcategoryId,
      productUsageTypeId,
    } = req.body;

    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await product.update({
      title,
      description,
      imageUrl,
      attributes,
      isVisible,
      basePrice,
      generalPrice: generalPrice || basePrice,
      architectPrice: architectPrice || basePrice * 0.9,
      dealerPrice: dealerPrice || basePrice * 0.85,
      categoryId,
      subcategoryId,
      productUsageTypeId,
    });

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete Product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await product.destroy();
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

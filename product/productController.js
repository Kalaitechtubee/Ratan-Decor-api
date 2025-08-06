const Product = require('./models');
const UserType = require('../userType/models');

// Create Product
exports.createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      imageUrl,
      userTypeId,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId,
      subcategoryId,
    } = req.body;

    const product = await Product.create({
      title,
      description,
      imageUrl,
      userTypeId,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId,
      subcategoryId,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get All Products with userType-based pricing
exports.getAllProducts = async (req, res) => {
  try {
    const { userType } = req.query;

    const products = await Product.findAll({
      include: [{ model: UserType }],
    });

    const data = products.map((product) => {
      let price;

      switch ((userType || '').toLowerCase()) {
        case 'architect':
          price = product.architectPrice;
          break;
        case 'dealer':
          price = product.dealerPrice;
          break;
        default:
          price = product.generalPrice;
      }

      return {
        id: product.id,
        title: product.title,
        description: product.description,
        imageUrl: product.imageUrl,
        price,
        userType: product.UserType?.typeName,
        isVisible: product.isVisible,
        categoryId: product.categoryId,
        subcategoryId: product.subcategoryId,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Product by ID with userType-based pricing
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userType } = req.query;

    const product = await Product.findByPk(id, {
      include: [{ model: UserType }],
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let price;

    switch ((userType || '').toLowerCase()) {
      case 'architect':
        price = product.architectPrice;
        break;
      case 'dealer':
        price = product.dealerPrice;
        break;
      default:
        price = product.generalPrice;
    }

    res.status(200).json({
      id: product.id,
      title: product.title,
      description: product.description,
      imageUrl: product.imageUrl,
      price,
      userType: product.UserType?.typeName,
      isVisible: product.isVisible,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update Product
exports.updateProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      imageUrl,
      attributes,
      isVisible,
      userTypeId,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId,
      subcategoryId,
    } = req.body;

    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await product.update({
      title,
      description,
      imageUrl,
      attributes,
      isVisible,
      userTypeId,
      generalPrice,
      architectPrice,
      dealerPrice,
      categoryId,
      subcategoryId,
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

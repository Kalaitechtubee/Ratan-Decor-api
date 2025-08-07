// cart/models.js
// Empty file - cart models are defined in models/index.js

// cart/controller.js
const { Cart, Product } = require('../models');

const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    
    const [cartItem, created] = await Cart.findOrCreate({
      where: { userId: req.user.id, productId },
      defaults: { quantity }
    });
    
    if (!created) {
      await cartItem.update({ quantity: cartItem.quantity + quantity });
    }
    
    res.status(201).json(cartItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getCart = async (req, res) => {
  try {
    const cartItems = await Cart.findAll({
      where: { userId: req.user.id },
      include: [Product]
    });
    
    const formattedCart = cartItems.map(item => ({
      ...item.toJSON(),
      price: req.user.role === 'Dealer' ? item.Product.dealerPrice :
             req.user.role === 'Architect' ? item.Product.architectPrice :
             item.Product.generalPrice
    }));
    
    res.json(formattedCart);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateCart = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const cartItem = await Cart.findOne({ where: { id, userId: req.user.id } });
    if (!cartItem) return res.status(404).json({ message: 'Cart item not found' });
    await cartItem.update({ quantity });
    res.json(cartItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const cartItem = await Cart.findOne({ where: { id, userId: req.user.id } });
    if (!cartItem) return res.status(404).json({ message: 'Cart item not found' });
    await cartItem.destroy();
    res.json({ message: 'Cart item deleted' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { addToCart, getCart, updateCart, deleteCartItem };
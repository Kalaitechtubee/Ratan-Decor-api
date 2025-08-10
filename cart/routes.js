// cart/routes.js
const express = require('express');
const router = express.Router();
const { addToCart, getCart, updateCart, deleteCartItem } = require('./controller');
const { authMiddleware } = require('../middleware/auth');
const { Cart, Product, User } = require('../models');

// Main cart routes
router.post('/', authMiddleware, addToCart);
router.get('/', authMiddleware, getCart);
router.put('/:id', authMiddleware, updateCart);
router.delete('/:id', authMiddleware, deleteCartItem);

// Debug route (remove in production)
router.get('/debug/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🔍 DEBUG ROUTE - Checking user:', userId);
    
    // Check if user exists
    const user = await User.findByPk(userId);
    
    // Check raw cart items
    const rawCartItems = await Cart.findAll({
      where: { userId: userId },
      raw: true
    });
    
    // Check cart items with products
    const cartWithProducts = await Cart.findAll({
      where: { userId: userId },
      include: [{ 
        model: Product,
        as: 'Product',
        required: false
      }]
    });
    
    // Check sample products
    const sampleProducts = await Product.findAll({
      attributes: ['id', 'name', 'isActive', 'generalPrice'],
      limit: 5,
      raw: true
    });
    
    // Check cart table structure
    const cartTableInfo = await Cart.describe();
    
    res.json({
      timestamp: new Date().toISOString(),
      user: user ? { 
        id: user.id, 
        name: user.name, 
        role: user.role,
        status: user.status 
      } : null,
      rawCartItems: rawCartItems,
      cartWithProducts: cartWithProducts.map(item => ({
        id: item.id,
        userId: item.userId,
        productId: item.productId,
        quantity: item.quantity,
        hasProduct: !!item.Product,
        productName: item.Product ? item.Product.name : null,
        productPrice: item.Product ? item.Product.generalPrice : null
      })),
      sampleProducts: sampleProducts,
      cartTableStructure: Object.keys(cartTableInfo),
      debug: {
        cartCount: rawCartItems.length,
        productCount: sampleProducts.length,
        associationsWorking: cartWithProducts.some(item => !!item.Product)
      }
    });
    
  } catch (error) {
    console.error('❌ DEBUG ROUTE ERROR:', error);
    res.status(500).json({ 
      error: error.message, 
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Clear cart route (for testing)
router.delete('/clear/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🧹 CLEARING CART for user:', userId);
    
    const deletedCount = await Cart.destroy({
      where: { userId: userId }
    });
    
    res.json({
      success: true,
      message: `Cleared ${deletedCount} items from cart`,
      deletedCount: deletedCount
    });
    
  } catch (error) {
    console.error('❌ CLEAR CART ERROR:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;
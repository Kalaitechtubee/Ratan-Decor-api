const { Cart, Product, User, Category, ProductUsageType } = require('../models');
const ProductService = require('../product/service');

// Add item to cart
const addToCart = async (req, res) => {
  try {
    console.log('ADD TO CART - Request details:');
    console.log('   Body:', JSON.stringify(req.body, null, 2));
    console.log('   User:', req.user);

    // Extract and validate input
    const { productId, quantity } = req.body;

    // Validate required fields
    if (!productId || !quantity) {
      console.log('Missing required fields:', { productId, quantity });
      return res.status(400).json({
        message: 'Product ID and quantity are required',
        received: { productId, quantity }
      });
    }

    // Convert to integers
    const prodId = parseInt(productId, 10);
    const qty = parseInt(quantity, 10);

    console.log('Parsed values:', { productId: prodId, quantity: qty });

    // Validate conversions
    if (isNaN(prodId) || prodId <= 0) {
      console.log('Invalid product ID:', prodId);
      return res.status(400).json({
        message: 'Invalid product ID - must be a positive integer',
        received: productId
      });
    }

    if (isNaN(qty) || qty <= 0) {
      console.log('Invalid quantity:', qty);
      return res.status(400).json({
        message: 'Invalid quantity - must be a positive integer',
        received: quantity
      });
    }

    // Check authentication - FIXED: use req.user.userId
    const userId = req.user?.userId || req.user?.id;
    if (!req.user || !userId) {
      console.log('User not authenticated', { hasUser: !!req.user, userId });
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Verify product exists with full details
    const product = await Product.findByPk(prodId, {
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'parentId']
        }
      ]
    });

    if (!product) {
      console.log('Product not found:', prodId);
      return res.status(404).json({
        message: 'Product not found',
        productId: prodId
      });
    }

    console.log('Product found:', { id: product.id, name: product.name, active: product.isActive });

    // Check if product is active
    if (!product.isActive) {
      console.log('Product is inactive:', prodId);
      return res.status(400).json({
        message: 'Product is not available',
        productId: prodId
      });
    }

    // Find or create cart item
    console.log('Finding or creating cart item for user:', userId, 'product:', prodId);

    const [cartItem, created] = await Cart.findOrCreate({
      where: {
        userId: userId,
        productId: prodId
      },
      defaults: {
        userId: userId,
        productId: prodId,
        quantity: qty
      }
    });

    console.log('Cart operation result:', {
      created,
      cartItemId: cartItem.id,
      quantity: cartItem.quantity
    });

    if (!created) {
      // Update existing cart item
      const newQuantity = cartItem.quantity + qty;
      await cartItem.update({ quantity: newQuantity });
      console.log('Cart item updated - new quantity:', newQuantity);
    } else {
      console.log('New cart item created');
    }

    // Process product data with all details
    const processedProduct = ProductService.processProductData(product, req);
    const price = ProductService.computePrice(product, req.user.role || 'General');

    const responseData = {
      id: cartItem.id,
      quantity: cartItem.quantity,
      userId: cartItem.userId,
      productId: cartItem.productId,
      Product: {
        ...processedProduct,
        price: price,
        priceBreakdown: {
          generalPrice: parseFloat(product.generalPrice),
          architectPrice: parseFloat(product.architectPrice),
          dealerPrice: parseFloat(product.dealerPrice),
          userPrice: price,
          userRole: req.user.role
        }
      }
    };

    console.log('Sending successful response');

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Item added to cart successfully' : 'Cart item quantity updated',
      cartItem: responseData
    });

  } catch (error) {
    console.error('ADD TO CART ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};

// Get cart items with full product details
const getCart = async (req, res) => {
  try {
    console.log('GET CART - Request details:');
    console.log('   User:', req.user);

    // Check authentication - FIXED: use req.user.userId
    const userId = req.user?.userId || req.user?.id;
    if (!req.user || !userId) {
      console.log('User not authenticated in getCart');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get cart items with complete product details
    console.log('Fetching cart items for user:', userId);

    const cartItems = await Cart.findAll({
      where: { userId: userId },
      include: [{
        model: Product,
        as: 'product',
        required: true, // Only include cart items with valid products
        where: {
          isActive: true // Only include active products
        },
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'parentId'],
            required: false
          }
        ]
      }],
      order: [['id', 'DESC']] // Latest items first
    });

    console.log('Found cart items:', cartItems.length);

    if (cartItems.length === 0) {
      console.log('No cart items found for user');
      return res.json({
        success: true,
        count: 0,
        cartItems: [],
        cartSummary: {
          totalItems: 0,
          totalQuantity: 0,
          subtotal: 0,
          gstAmount: 0,
          totalAmount: 0
        },
        message: 'Your cart is empty'
      });
    }

    // Format cart items with complete product details and role-based pricing
    let totalQuantity = 0;
    let subtotal = 0;
    let totalGstAmount = 0;

    const formattedCart = cartItems.map(item => {
      const product = item.product;
      const processedProduct = ProductService.processProductData(product, req);
      const price = ProductService.computePrice(product, req.user.role || 'General');
      const gstRate = parseFloat(processedProduct.gst || 0);
      const itemSubtotal = price * item.quantity;
      const itemGstAmount = (itemSubtotal * gstRate) / 100;

      // Update totals
      totalQuantity += item.quantity;
      subtotal += itemSubtotal;
      totalGstAmount += itemGstAmount;

      return {
        id: item.id,
        quantity: item.quantity,
        userId: item.userId,
        productId: item.productId,
        product: {
          ...processedProduct,
          price: price,
          priceBreakdown: {
            generalPrice: parseFloat(product.generalPrice),
            architectPrice: parseFloat(product.architectPrice),
            dealerPrice: parseFloat(product.dealerPrice),
            userPrice: price,
            userRole: req.user.role
          }
        },
        // Item calculations
        itemCalculations: {
          unitPrice: price,
          quantity: item.quantity,
          subtotal: itemSubtotal,
          gstRate: gstRate,
          gstAmount: itemGstAmount,
          totalAmount: itemSubtotal + itemGstAmount
        }
      };
    });

    const cartSummary = {
      totalItems: formattedCart.length,
      totalQuantity: totalQuantity,
      subtotal: parseFloat(subtotal.toFixed(2)),
      gstAmount: parseFloat(totalGstAmount.toFixed(2)),
      totalAmount: parseFloat((subtotal + totalGstAmount).toFixed(2))
    };

    console.log('Returning', formattedCart.length, 'formatted cart items with summary:', cartSummary);

    res.json({
      success: true,
      count: formattedCart.length,
      cartItems: formattedCart,
      cartSummary: cartSummary,
      userRole: req.user.role
    });

  } catch (error) {
    console.error('GET CART ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};

// Update cart item
const updateCart = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    console.log('UPDATE CART - Request details:');
    console.log('   Cart Item ID:', id);
    console.log('   New Quantity:', quantity);
    console.log('   User:', req.user);

    // Get user ID correctly
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate quantity
    const qty = parseInt(quantity, 10);

    if (!quantity || isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer',
        received: quantity
      });
    }

    // Find cart item with full product details
    const cartItem = await Cart.findOne({
      where: {
        id: id,
        userId: userId
      },
      include: [{
        model: Product,
        as: 'product',
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'parentId'],
            required: false
          }
        ]
      }]
    });

    if (!cartItem) {
      console.log('Cart item not found:', { id, userId });
      return res.status(404).json({
        success: false,
        message: 'Cart item not found or does not belong to user'
      });
    }

    // Update quantity
    await cartItem.update({ quantity: qty });

    console.log('Cart item updated successfully');

    // Process product data and calculate pricing
    const product = cartItem.product;
    const processedProduct = ProductService.processProductData(product, req);
    const price = ProductService.computePrice(product, req.user.role || 'General');
    const gstRate = parseFloat(processedProduct.gst || 0);
    const itemSubtotal = price * qty;
    const itemGstAmount = (itemSubtotal * gstRate) / 100;

    const responseData = {
      id: cartItem.id,
      quantity: cartItem.quantity,
      userId: cartItem.userId,
      productId: cartItem.productId,
      product: {
        ...processedProduct,
        price: price,
        priceBreakdown: {
          generalPrice: parseFloat(product.generalPrice),
          architectPrice: parseFloat(product.architectPrice),
          dealerPrice: parseFloat(product.dealerPrice),
          userPrice: price,
          userRole: req.user.role
        }
      },
      itemCalculations: {
        unitPrice: price,
        quantity: qty,
        subtotal: itemSubtotal,
        gstRate: gstRate,
        gstAmount: itemGstAmount,
        totalAmount: itemSubtotal + itemGstAmount
      }
    };

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      cartItem: responseData
    });

  } catch (error) {
    console.error('UPDATE CART ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};

// Delete cart item
const deleteCartItem = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('DELETE CART ITEM - Request details:');
    console.log('   Cart Item ID:', id);
    console.log('   User:', req.user);

    // Get user ID correctly
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const cartItem = await Cart.findOne({
      where: {
        id: id,
        userId: userId
      }
    });

    if (!cartItem) {
      console.log('Cart item not found for deletion:', { id, userId });
      return res.status(404).json({
        success: false,
        message: 'Cart item not found or does not belong to user'
      });
    }

    await cartItem.destroy();

    console.log('Cart item deleted successfully');

    res.json({
      success: true,
      message: 'Cart item deleted successfully',
      deletedItemId: parseInt(id)
    });

  } catch (error) {
    console.error('DELETE CART ITEM ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};

// Get cart count (useful for header badges)
const getCartCount = async (req, res) => {
  try {
    // Get user ID correctly
    const userId = req.user?.userId || req.user?.id;
    if (!req.user || !userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const count = await Cart.count({
      where: { userId: userId },
      include: [{
        model: Product,
        as: 'product',
        where: { isActive: true },
        required: true
      }]
    });

    const totalQuantity = await Cart.sum('quantity', {
      where: { userId: userId },
      include: [{
        model: Product,
        as: 'product',
        where: { isActive: true },
        required: true
      }]
    });

    res.json({
      success: true,
      cartCount: {
        totalItems: count || 0,
        totalQuantity: totalQuantity || 0
      }
    });

  } catch (error) {
    console.error('GET CART COUNT ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};

// Clear entire cart
const clearCart = async (req, res) => {
  try {
    // Get user ID correctly
    const userId = req.user?.userId || req.user?.id;
    if (!req.user || !userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const deletedCount = await Cart.destroy({
      where: { userId: userId }
    });

    res.json({
      success: true,
      message: `Cleared ${deletedCount} items from cart`,
      deletedCount: deletedCount
    });

  } catch (error) {
    console.error('CLEAR CART ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCart,
  deleteCartItem,
  getCartCount,
  clearCart
};
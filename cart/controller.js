const { Cart, Product, User, Category, ProductUsageType } = require('../models');

// Helper function to get image URL
const getImageUrl = (filename, req) => {
  if (!filename) return null;
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  if (filename.startsWith('/uploads/')) return filename;
  const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
  return `${baseUrl}/uploads/products/${filename}`;
};

// Helper function to process product data with all details
const processProductData = (product, req) => {
  const productData = product.toJSON ? product.toJSON() : product;
  
  // Handle single image
  if (productData.image) {
    productData.imageUrl = getImageUrl(productData.image, req);
  }
  
  // Handle multiple images
  if (productData.images && Array.isArray(productData.images)) {
    productData.imageUrls = productData.images.map(img => getImageUrl(img, req));
  } else {
    productData.imageUrls = [];
  }
  
  // Ensure colors is an array
  if (!Array.isArray(productData.colors)) {
    productData.colors = [];
  }
  
  // Ensure specifications is an object
  if (!productData.specifications || typeof productData.specifications !== 'object') {
    productData.specifications = {};
  }
  
  return productData;
};

// Helper function to determine price based on user role
const computePrice = (product, userRole) => {
  switch (userRole) {
    case 'Dealer':
      return parseFloat(product.dealerPrice || product.generalPrice);
    case 'Architect':
      return parseFloat(product.architectPrice || product.generalPrice);
    default:
      return parseFloat(product.generalPrice);
  }
};

// Add item to cart
const addToCart = async (req, res) => {
  try {
    console.log('📥 ADD TO CART - Request details:');
    console.log('   Body:', JSON.stringify(req.body, null, 2));
    console.log('   User ID:', req.user?.id);
    console.log('   User Role:', req.user?.role);
    
    // Extract and validate input
    const { productId, quantity } = req.body;
    
    // Validate required fields
    if (!productId || !quantity) {
      console.log('❌ Missing required fields:', { productId, quantity });
      return res.status(400).json({ 
        message: 'Product ID and quantity are required',
        received: { productId, quantity }
      });
    }
    
    // Convert to integers
    const prodId = parseInt(productId, 10);
    const qty = parseInt(quantity, 10);
    
    console.log('📥 Parsed values:', { productId: prodId, quantity: qty });
    
    // Validate conversions
    if (isNaN(prodId) || prodId <= 0) {
      console.log('❌ Invalid product ID:', prodId);
      return res.status(400).json({ 
        message: 'Invalid product ID - must be a positive integer',
        received: productId
      });
    }
    
    if (isNaN(qty) || qty <= 0) {
      console.log('❌ Invalid quantity:', qty);
      return res.status(400).json({ 
        message: 'Invalid quantity - must be a positive integer',
        received: quantity
      });
    }
    
    // Check authentication
    if (!req.user || !req.user.id) {
      console.log('❌ User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    // Verify product exists with full details
    const product = await Product.findByPk(prodId, {
      include: [
        { 
          model: Category, 
          as: 'Category', 
          attributes: ['id', 'name', 'parentId'] 
        },
        { 
          model: ProductUsageType, 
          as: 'UsageType', 
          attributes: ['id', 'name', 'description'] 
        }
      ]
    });
    
    if (!product) {
      console.log('❌ Product not found:', prodId);
      return res.status(404).json({ 
        message: 'Product not found',
        productId: prodId
      });
    }
    
    console.log('✅ Product found:', { id: product.id, name: product.name, active: product.isActive });
    
    // Check if product is active
    if (!product.isActive) {
      console.log('❌ Product is inactive:', prodId);
      return res.status(400).json({ 
        message: 'Product is not available',
        productId: prodId
      });
    }
    
    // Find or create cart item
    console.log('📦 Finding or creating cart item for user:', req.user.id, 'product:', prodId);
    
    const [cartItem, created] = await Cart.findOrCreate({
      where: { 
        userId: req.user.id, 
        productId: prodId 
      },
      defaults: { 
        userId: req.user.id,
        productId: prodId,
        quantity: qty 
      }
    });
    
    console.log('📦 Cart operation result:', { 
      created, 
      cartItemId: cartItem.id,
      quantity: cartItem.quantity
    });
    
    if (!created) {
      // Update existing cart item
      const newQuantity = cartItem.quantity + qty;
      await cartItem.update({ quantity: newQuantity });
      console.log('✅ Cart item updated - new quantity:', newQuantity);
    } else {
      console.log('✅ New cart item created');
    }
    
    // Process product data with all details
    const processedProduct = processProductData(product, req);
    const price = computePrice(product, req.user.role);
    
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
        },
        // Include all product fields
        gst: parseFloat(product.gst || 0),
        averageRating: parseFloat(product.averageRating || 0),
        totalRatings: parseInt(product.totalRatings || 0),
        colors: product.colors || [],
        specifications: product.specifications || {},
        visibleTo: product.visibleTo || [],
        Category: product.Category ? {
          id: product.Category.id,
          name: product.Category.name,
          parentId: product.Category.parentId
        } : null,
        UsageType: product.UsageType ? {
          id: product.UsageType.id,
          name: product.UsageType.name,
          description: product.UsageType.description
        } : null
      }
    };
    
    console.log('✅ Sending successful response');
    
    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Item added to cart successfully' : 'Cart item quantity updated',
      cartItem: responseData
    });
    
  } catch (error) {
    console.error('❌ ADD TO CART ERROR:', error);
    console.error('❌ Error stack:', error.stack);
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
    console.log('📋 GET CART - Request details:');
    console.log('   User ID:', req.user?.id);
    console.log('   User Role:', req.user?.role);
    
    // Check authentication
    if (!req.user || !req.user.id) {
      console.log('❌ User not authenticated in getCart');
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }
    
    // Get cart items with complete product details
    console.log('📋 Fetching cart items for user:', req.user.id);
    
    const cartItems = await Cart.findAll({
      where: { userId: req.user.id },
      include: [{ 
        model: Product,
        as: 'Product',
        required: true, // Only include cart items with valid products
        where: {
          isActive: true // Only include active products
        },
        include: [
          { 
            model: Category, 
            as: 'Category', 
            attributes: ['id', 'name', 'parentId'],
            required: false 
          },
          { 
            model: ProductUsageType, 
            as: 'UsageType', 
            attributes: ['id', 'name', 'description'],
            required: false 
          }
        ]
      }],
      order: [['id', 'DESC']] // Latest items first
    });
    
    console.log('📋 Found cart items:', cartItems.length);
    
    if (cartItems.length === 0) {
      console.log('📋 No cart items found for user');
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
      const product = item.Product;
      const processedProduct = processProductData(product, req);
      const price = computePrice(product, req.user.role);
      const gstRate = parseFloat(product.gst || 0);
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
        Product: {
          ...processedProduct,
          price: price,
          priceBreakdown: {
            generalPrice: parseFloat(product.generalPrice),
            architectPrice: parseFloat(product.architectPrice),
            dealerPrice: parseFloat(product.dealerPrice),
            userPrice: price,
            userRole: req.user.role
          },
          // Include all product fields
          gst: gstRate,
          averageRating: parseFloat(product.averageRating || 0),
          totalRatings: parseInt(product.totalRatings || 0),
          colors: product.colors || [],
          specifications: product.specifications || {},
          visibleTo: product.visibleTo || [],
          Category: product.Category ? {
            id: product.Category.id,
            name: product.Category.name,
            parentId: product.Category.parentId
          } : null,
          UsageType: product.UsageType ? {
            id: product.UsageType.id,
            name: product.UsageType.name,
            description: product.UsageType.description
          } : null
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
    
    console.log('📋 Returning', formattedCart.length, 'formatted cart items with summary:', cartSummary);
    
    res.json({
      success: true,
      count: formattedCart.length,
      cartItems: formattedCart,
      cartSummary: cartSummary,
      userRole: req.user.role
    });
    
  } catch (error) {
    console.error('❌ GET CART ERROR:', error);
    console.error('❌ Error stack:', error.stack);
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
    
    console.log('🔄 UPDATE CART - Request details:');
    console.log('   Cart Item ID:', id);
    console.log('   New Quantity:', quantity);
    console.log('   User ID:', req.user?.id);
    
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
        userId: req.user.id 
      },
      include: [{ 
        model: Product,
        as: 'Product',
        include: [
          { 
            model: Category, 
            as: 'Category', 
            attributes: ['id', 'name', 'parentId'],
            required: false 
          },
          { 
            model: ProductUsageType, 
            as: 'UsageType', 
            attributes: ['id', 'name', 'description'],
            required: false 
          }
        ]
      }]
    });
    
    if (!cartItem) {
      console.log('❌ Cart item not found:', { id, userId: req.user.id });
      return res.status(404).json({ 
        success: false,
        message: 'Cart item not found or does not belong to user' 
      });
    }
    
    // Update quantity
    await cartItem.update({ quantity: qty });
    
    console.log('✅ Cart item updated successfully');
    
    // Process product data and calculate pricing
    const product = cartItem.Product;
    const processedProduct = processProductData(product, req);
    const price = computePrice(product, req.user.role);
    const gstRate = parseFloat(product.gst || 0);
    const itemSubtotal = price * qty;
    const itemGstAmount = (itemSubtotal * gstRate) / 100;
    
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
        },
        gst: gstRate,
        averageRating: parseFloat(product.averageRating || 0),
        totalRatings: parseInt(product.totalRatings || 0),
        colors: product.colors || [],
        specifications: product.specifications || {},
        visibleTo: product.visibleTo || [],
        Category: product.Category ? {
          id: product.Category.id,
          name: product.Category.name,
          parentId: product.Category.parentId
        } : null,
        UsageType: product.UsageType ? {
          id: product.UsageType.id,
          name: product.UsageType.name,
          description: product.UsageType.description
        } : null
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
    console.error('❌ UPDATE CART ERROR:', error);
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
    
    console.log('🗑️ DELETE CART ITEM - Request details:');
    console.log('   Cart Item ID:', id);
    console.log('   User ID:', req.user?.id);
    
    const cartItem = await Cart.findOne({ 
      where: { 
        id: id, 
        userId: req.user.id 
      } 
    });
    
    if (!cartItem) {
      console.log('❌ Cart item not found for deletion:', { id, userId: req.user.id });
      return res.status(404).json({ 
        success: false,
        message: 'Cart item not found or does not belong to user' 
      });
    }
    
    await cartItem.destroy();
    
    console.log('✅ Cart item deleted successfully');
    
    res.json({ 
      success: true,
      message: 'Cart item deleted successfully',
      deletedItemId: parseInt(id)
    });
    
  } catch (error) {
    console.error('❌ DELETE CART ITEM ERROR:', error);
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
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }
    
    const count = await Cart.count({
      where: { userId: req.user.id },
      include: [{
        model: Product,
        as: 'Product',
        where: { isActive: true },
        required: true
      }]
    });
    
    const totalQuantity = await Cart.sum('quantity', {
      where: { userId: req.user.id },
      include: [{
        model: Product,
        as: 'Product',
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
    console.error('❌ GET CART COUNT ERROR:', error);
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
  getCartCount
};

// Additional utility functions that you might need

// Clear entire cart
const clearCart = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }
    
    const deletedCount = await Cart.destroy({
      where: { userId: req.user.id }
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
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};

// Export the clearCart function as well
module.exports.clearCart = clearCart;
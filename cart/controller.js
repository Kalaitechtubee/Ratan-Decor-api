const { Cart, Product, User } = require('../models');

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
    
    // Verify product exists
    const product = await Product.findByPk(prodId);
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
    
    // Fetch the cart item with product details
    const updatedCartItem = await Cart.findByPk(cartItem.id, {
      include: [{ 
        model: Product,
        as: 'Product',
        attributes: ['id', 'name', 'description', 'image', 'generalPrice', 'architectPrice', 'dealerPrice', 'isActive']
      }]
    });
    
    if (!updatedCartItem || !updatedCartItem.Product) {
      console.log('❌ Failed to fetch cart item with product details');
      return res.status(500).json({ message: 'Failed to create cart item' });
    }
    
    // Determine price based on user role
    let price;
    switch (req.user.role) {
      case 'Dealer':
        price = updatedCartItem.Product.dealerPrice;
        break;
      case 'Architect':
        price = updatedCartItem.Product.architectPrice;
        break;
      default:
        price = updatedCartItem.Product.generalPrice;
    }
    
    const responseData = {
      id: updatedCartItem.id,
      quantity: updatedCartItem.quantity,
      userId: updatedCartItem.userId,
      productId: updatedCartItem.productId,
      Product: {
        id: updatedCartItem.Product.id,
        name: updatedCartItem.Product.name,
        description: updatedCartItem.Product.description,
        image: updatedCartItem.Product.image,
        price: parseFloat(price),
        isActive: updatedCartItem.Product.isActive
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

// Get cart items
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
    
    // Get cart items with product details
    console.log('📋 Fetching cart items for user:', req.user.id);
    
    const cartItems = await Cart.findAll({
      where: { userId: req.user.id },
      include: [{ 
        model: Product,
        as: 'Product',
        required: true, // Only include cart items with valid products
        attributes: ['id', 'name', 'description', 'image', 'generalPrice', 'architectPrice', 'dealerPrice', 'isActive'],
        where: {
          isActive: true // Only include active products
        }
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
        message: 'Your cart is empty'
      });
    }
    
    // Format cart items with role-based pricing
    const formattedCart = cartItems.map(item => {
      const product = item.Product;
      let price;
      
      // Determine price based on user role
      switch (req.user.role) {
        case 'Dealer':
          price = product.dealerPrice;
          break;
        case 'Architect':
          price = product.architectPrice;
          break;
        default:
          price = product.generalPrice;
      }
      
      return {
        id: item.id,
        quantity: item.quantity,
        userId: item.userId,
        productId: item.productId,
        Product: {
          id: product.id,
          name: product.name,
          description: product.description,
          image: product.image,
          price: parseFloat(price),
          isActive: product.isActive
        }
      };
    });
    
    console.log('📋 Returning', formattedCart.length, 'formatted cart items');
    
    res.json({
      success: true,
      count: formattedCart.length,
      cartItems: formattedCart
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
    
    // Find cart item
    const cartItem = await Cart.findOne({ 
      where: { 
        id: id, 
        userId: req.user.id 
      },
      include: [{ 
        model: Product,
        as: 'Product',
        attributes: ['id', 'name', 'description', 'image', 'generalPrice', 'architectPrice', 'dealerPrice', 'isActive']
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
    
    // Determine price based on user role
    let price;
    switch (req.user.role) {
      case 'Dealer':
        price = cartItem.Product.dealerPrice;
        break;
      case 'Architect':
        price = cartItem.Product.architectPrice;
        break;
      default:
        price = cartItem.Product.generalPrice;
    }
    
    const responseData = {
      id: cartItem.id,
      quantity: cartItem.quantity,
      userId: cartItem.userId,
      productId: cartItem.productId,
      Product: {
        id: cartItem.Product.id,
        name: cartItem.Product.name,
        description: cartItem.Product.description,
        image: cartItem.Product.image,
        price: parseFloat(price),
        isActive: cartItem.Product.isActive
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

module.exports = { addToCart, getCart, updateCart, deleteCartItem };
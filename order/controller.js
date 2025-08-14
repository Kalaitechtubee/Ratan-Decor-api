// order/controller.js
const { Order, OrderItem, Product, Cart, User, Category, ProductUsageType, ShippingAddress, sequelize } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');

// Helper function to get image URL
const getImageUrl = (filename, req) => {
  if (!filename) return null;
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  if (filename.startsWith('/uploads/')) return filename;
  const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
  return `${baseUrl}/uploads/products/${filename}`;
};

// Helper function to process product data
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

// Create order from cart or custom items
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    console.log('📦 CREATE ORDER - Request details:');
    console.log('   User ID:', req.user?.id);
    console.log('   User Role:', req.user?.role);
    console.log('   Body:', JSON.stringify(req.body, null, 2));
    
    const { 
      paymentMethod, 
      paymentProof, 
      items, // Optional: custom items, if not provided, will use cart
      shippingAddressId,
      notes,
      expectedDeliveryDate 
    } = req.body;

    // Validate required fields
    if (!paymentMethod || !['Gateway', 'UPI', 'BankTransfer'].includes(paymentMethod)) {
      return res.status(400).json({ 
        success: false,
        message: 'Valid payment method is required (Gateway, UPI, BankTransfer)' 
      });
    }

    if (paymentMethod !== 'Gateway' && !paymentProof) {
      return res.status(400).json({ 
        success: false,
        message: 'Payment proof is required for UPI and Bank Transfer' 
      });
    }

    // Get items from cart if not provided
    let orderItems = [];
    if (items && items.length > 0) {
      // Use provided items
      orderItems = items;
    } else {
      // Get items from cart
      const cartItems = await Cart.findAll({
        where: { userId: req.user.id },
        include: [{
          model: Product,
          as: 'Product',
          where: { isActive: true },
          required: true
        }]
      });

      if (cartItems.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'No items found in cart or provided' 
        });
      }

      orderItems = cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));
    }

    console.log('📦 Processing order items:', orderItems.length);

    // Validate and calculate order totals
    let subtotal = 0;
    let totalGstAmount = 0;
    const processedOrderItems = [];

    for (const item of orderItems) {
      // Get product with full details
      const product = await Product.findByPk(item.productId, {
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
      });

      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }

      if (!product.isActive) {
        throw new Error(`Product "${product.name}" is not available`);
      }

      // Calculate pricing
      const unitPrice = computePrice(product, req.user.role);
      const quantity = parseInt(item.quantity);
      const itemSubtotal = unitPrice * quantity;
      const gstRate = parseFloat(product.gst || 0);
      const itemGstAmount = (itemSubtotal * gstRate) / 100;
      const itemTotal = itemSubtotal + itemGstAmount;

      subtotal += itemSubtotal;
      totalGstAmount += itemGstAmount;

      processedOrderItems.push({
        productId: product.id,
        quantity: quantity,
        price: unitPrice,
        subtotal: itemSubtotal,
        gstRate: gstRate,
        gstAmount: itemGstAmount,
        total: itemTotal,
        productSnapshot: {
          name: product.name,
          description: product.description,
          image: product.image,
          images: product.images || [],
          specifications: product.specifications || {},
          colors: product.colors || [],
          category: product.Category ? product.Category.name : null,
          usageType: product.UsageType ? product.UsageType.name : null
        }
      });
    }

    // Calculate final totals
    const platformCommission = subtotal * 0.02; // 2% platform commission
    const finalTotal = subtotal + totalGstAmount + platformCommission;

    console.log('📦 Order calculations:', {
      subtotal: subtotal.toFixed(2),
      totalGstAmount: totalGstAmount.toFixed(2),
      platformCommission: platformCommission.toFixed(2),
      finalTotal: finalTotal.toFixed(2)
    });

    // Validate shipping address if provided
    let shippingAddress = null;
    if (shippingAddressId) {
      shippingAddress = await ShippingAddress.findOne({
        where: { 
          id: shippingAddressId, 
          userId: req.user.id 
        }
      });
      
      if (!shippingAddress) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid shipping address' 
        });
      }
    }

    // Create order
    const order = await Order.create({
      userId: req.user.id,
      paymentMethod,
      paymentProof,
      total: parseFloat(finalTotal.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      gstAmount: parseFloat(totalGstAmount.toFixed(2)),
      platformCommission: parseFloat(platformCommission.toFixed(2)),
      paymentStatus: paymentMethod === 'Gateway' ? 'Approved' : 'Awaiting',
      status: 'Pending',
      shippingAddressId: shippingAddressId || null,
      notes: notes || null,
      expectedDeliveryDate: expectedDeliveryDate || null,
      orderDate: new Date()
    }, { transaction });

    console.log('📦 Order created with ID:', order.id);

    // Create order items
    const orderItemsData = processedOrderItems.map(item => ({
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      subtotal: parseFloat(item.subtotal.toFixed(2)),
      gstRate: item.gstRate,
      gstAmount: parseFloat(item.gstAmount.toFixed(2)),
      total: parseFloat(item.total.toFixed(2)),
      productSnapshot: JSON.stringify(item.productSnapshot)
    }));

    await OrderItem.bulkCreate(orderItemsData, { transaction });

    console.log('📦 Order items created:', orderItemsData.length);

    // Clear cart if order was created from cart
    if (!items || items.length === 0) {
      await Cart.destroy({ 
        where: { userId: req.user.id }, 
        transaction 
      });
      console.log('📦 Cart cleared after order creation');
    }

    // Send to CRM (optional integration)
    try {
      await axios.post('https://crm-api.example.com/orders', {
        orderId: order.id,
        userId: req.user.id,
        userRole: req.user.role,
        total: finalTotal,
        subtotal: subtotal,
        gstAmount: totalGstAmount,
        itemCount: processedOrderItems.length,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderDate: order.orderDate
      }, {
        timeout: 5000 // 5 second timeout
      });
      console.log('📦 Order sent to CRM successfully');
    } catch (crmError) {
      console.error('❌ CRM integration failed:', crmError.message);
      // Don't fail the order creation if CRM fails
    }

    await transaction.commit();
    console.log('✅ Order creation completed successfully');

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        total: order.total,
        subtotal: order.subtotal,
        gstAmount: order.gstAmount,
        platformCommission: order.platformCommission,
        itemCount: processedOrderItems.length,
        orderDate: order.orderDate,
        expectedDeliveryDate: order.expectedDeliveryDate
      },
      redirectToPayment: paymentMethod === 'Gateway' // Frontend can use this flag
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ CREATE ORDER ERROR:', error);
    res.status(400).json({ 
      success: false,
      message: error.message || 'Failed to create order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get orders with full details
const getOrders = async (req, res) => {
  try {
    console.log('📋 GET ORDERS - Request details:');
    console.log('   User ID:', req.user?.id);
    console.log('   User Role:', req.user?.role);
    console.log('   Query:', req.query);

    const { 
      status, 
      paymentStatus, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10,
      sortBy = 'orderDate',
      sortOrder = 'DESC'
    } = req.query;

    // Build where clause
    const where = { userId: req.user.id };
    
    if (status) {
      if (Array.isArray(status)) {
        where.status = { [Op.in]: status };
      } else {
        where.status = status;
      }
    }
    
    if (paymentStatus) {
      if (Array.isArray(paymentStatus)) {
        where.paymentStatus = { [Op.in]: paymentStatus };
      } else {
        where.paymentStatus = paymentStatus;
      }
    }
    
    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate[Op.gte] = new Date(startDate);
      if (endDate) where.orderDate[Op.lte] = new Date(endDate);
    }

    // Calculate pagination
    const offset = (page - 1) * limit;
    
    // Get orders with full details
    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'OrderItems',
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
        },
        {
          model: ShippingAddress,
          as: 'ShippingAddress',
          required: false
        },
        {
          model: User,
          as: 'User',
          attributes: ['id', 'name', 'email', 'role'],
          required: false
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: Number(limit),
      offset: Number(offset)
    });

    console.log('📋 Found orders:', orders.length);

    // Process orders with complete details
    const processedOrders = orders.map(order => {
      const orderData = order.toJSON();
      
      // Process order items with product details
      if (orderData.OrderItems) {
        orderData.OrderItems = orderData.OrderItems.map(item => {
          const itemData = { ...item };
          
          if (item.Product) {
            const processedProduct = processProductData(item.Product, req);
            itemData.Product = {
              ...processedProduct,
              // Add role-based current price (might be different from order price)
              currentPrice: computePrice(item.Product, req.user.role),
              orderPrice: parseFloat(item.price) // Price at time of order
            };
          }
          
          // Parse product snapshot if available
          if (item.productSnapshot) {
            try {
              itemData.productSnapshot = typeof item.productSnapshot === 'string' 
                ? JSON.parse(item.productSnapshot) 
                : item.productSnapshot;
            } catch (e) {
              itemData.productSnapshot = {};
            }
          }
          
          return itemData;
        });
      }
      
      return orderData;
    });

    // Calculate summary statistics
    const orderSummary = {
      totalOrders: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      ordersPerPage: Number(limit),
      statusBreakdown: {},
      paymentStatusBreakdown: {}
    };

    // Get status breakdown
    const statusStats = await Order.findAll({
      where: { userId: req.user.id },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalAmount']
      ],
      group: ['status'],
      raw: true
    });

    statusStats.forEach(stat => {
      orderSummary.statusBreakdown[stat.status] = {
        count: parseInt(stat.count),
        totalAmount: parseFloat(stat.totalAmount || 0)
      };
    });

    // Get payment status breakdown
    const paymentStats = await Order.findAll({
      where: { userId: req.user.id },
      attributes: [
        'paymentStatus',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalAmount']
      ],
      group: ['paymentStatus'],
      raw: true
    });

    paymentStats.forEach(stat => {
      orderSummary.paymentStatusBreakdown[stat.paymentStatus] = {
        count: parseInt(stat.count),
        totalAmount: parseFloat(stat.totalAmount || 0)
      };
    });

    console.log('📋 Returning', processedOrders.length, 'processed orders');

    res.json({
      success: true,
      orders: processedOrders,
      orderSummary: orderSummary,
      filters: {
        status,
        paymentStatus,
        startDate,
        endDate
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      },
      sorting: {
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('❌ GET ORDERS ERROR:', error);
    res.status(400).json({ 
      success: false,
      message: error.message || 'Failed to fetch orders',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get single order by ID with full details
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📋 GET ORDER BY ID - Order ID:', id, 'User ID:', req.user?.id);

    const order = await Order.findOne({
      where: { 
        id: id,
        // Users can only see their own orders, admins can see all
        ...(req.user.role === 'Admin' || req.user.role === 'Manager' ? {} : { userId: req.user.id })
      },
      include: [
        {
          model: OrderItem,
          as: 'OrderItems',
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
        },
        {
          model: ShippingAddress,
          as: 'ShippingAddress',
          required: false
        },
        {
          model: User,
          as: 'User',
          attributes: ['id', 'name', 'email', 'role', 'mobile', 'company'],
          required: false
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    // Process order with complete details
    const orderData = order.toJSON();
    
    // Process order items
    if (orderData.OrderItems) {
      orderData.OrderItems = orderData.OrderItems.map(item => {
        const itemData = { ...item };
        
        if (item.Product) {
          const processedProduct = processProductData(item.Product, req);
          itemData.Product = {
            ...processedProduct,
            currentPrice: computePrice(item.Product, req.user.role),
            orderPrice: parseFloat(item.price),
            priceChange: computePrice(item.Product, req.user.role) - parseFloat(item.price)
          };
        }
        
        // Parse product snapshot
        if (item.productSnapshot) {
          try {
            itemData.productSnapshot = typeof item.productSnapshot === 'string' 
              ? JSON.parse(item.productSnapshot) 
              : item.productSnapshot;
          } catch (e) {
            itemData.productSnapshot = {};
          }
        }
        
        return itemData;
      });
    }

    console.log('📋 Returning order details for order:', id);

    res.json({
      success: true,
      order: orderData
    });

  } catch (error) {
    console.error('❌ GET ORDER BY ID ERROR:', error);
    res.status(400).json({ 
      success: false,
      message: error.message || 'Failed to fetch order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Update order (for admins and order owners with limited fields)
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      status, 
      paymentStatus, 
      paymentProof, 
      notes,
      expectedDeliveryDate,
      trackingNumber,
      shippingProvider 
    } = req.body;
    
    console.log('🔄 UPDATE ORDER - Order ID:', id, 'User Role:', req.user?.role);
    console.log('   Update data:', { status, paymentStatus, notes });

    // Find order
    const order = await Order.findOne({
      where: { 
        id: id,
        // Users can only update their own orders, admins can update all
        ...(req.user.role === 'Admin' || req.user.role === 'Manager' ? {} : { userId: req.user.id })
      }
    });

    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    // Prepare update data based on user role
    const updateData = {};
    
    if (req.user.role === 'Admin' || req.user.role === 'Manager') {
      // Admins can update all fields
      if (status !== undefined) updateData.status = status;
      if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
      if (notes !== undefined) updateData.notes = notes;
      if (expectedDeliveryDate !== undefined) updateData.expectedDeliveryDate = expectedDeliveryDate;
      if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
      if (shippingProvider !== undefined) updateData.shippingProvider = shippingProvider;
    } else {
      // Regular users can only update limited fields and only for certain statuses
      if (order.status === 'Pending' && paymentProof !== undefined) {
        updateData.paymentProof = paymentProof;
      }
      if (notes !== undefined) updateData.notes = notes;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No valid fields to update' 
      });
    }

    // Validate status transitions
    if (status && order.status !== status) {
      const validTransitions = {
        'Pending': ['Processing', 'Cancelled'],
        'Processing': ['Shipped', 'Cancelled'],
        'Shipped': ['Completed'],
        'Completed': [], // Cannot change from completed
        'Cancelled': [] // Cannot change from cancelled
      };

      if (!validTransitions[order.status]?.includes(status)) {
        return res.status(400).json({ 
          success: false,
          message: `Cannot change order status from ${order.status} to ${status}` 
        });
      }
    }

    // Update order
    await order.update(updateData);

    console.log('✅ Order updated successfully');

    // Send update to CRM
    try {
      await axios.put(`https://crm-api.example.com/orders/${id}`, {
        orderId: id,
        ...updateData,
        updatedBy: req.user.id,
        updatedByRole: req.user.role,
        updatedAt: new Date()
      }, {
        timeout: 5000
      });
      console.log('📦 Order update sent to CRM successfully');
    } catch (crmError) {
      console.error('❌ CRM update failed:', crmError.message);
      // Don't fail the update if CRM fails
    }

    res.json({
      success: true,
      message: 'Order updated successfully',
      order: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        notes: order.notes,
        expectedDeliveryDate: order.expectedDeliveryDate,
        trackingNumber: order.trackingNumber,
        shippingProvider: order.shippingProvider,
        updatedAt: order.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ UPDATE ORDER ERROR:', error);
    res.status(400).json({ 
      success: false,
      message: error.message || 'Failed to update order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Cancel order (soft delete by changing status)
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    console.log('❌ CANCEL ORDER - Order ID:', id, 'User ID:', req.user?.id);

    const order = await Order.findOne({
      where: { 
        id: id,
        userId: req.user.id // Users can only cancel their own orders
      }
    });

    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    // Check if order can be cancelled
    if (!['Pending', 'Processing'].includes(order.status)) {
      return res.status(400).json({ 
        success: false,
        message: `Cannot cancel order with status: ${order.status}` 
      });
    }

    // Update order status to cancelled
    await order.update({ 
      status: 'Cancelled',
      cancellationReason: reason || 'Cancelled by user',
      cancelledAt: new Date()
    });

    console.log('✅ Order cancelled successfully');

    // Notify CRM
    try {
      await axios.put(`https://crm-api.example.com/orders/${id}/cancel`, {
        orderId: id,
        reason: reason || 'Cancelled by user',
        cancelledBy: req.user.id,
        cancelledAt: new Date()
      }, {
        timeout: 5000
      });
    } catch (crmError) {
      console.error('❌ CRM cancellation notification failed:', crmError.message);
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        id: order.id,
        status: order.status,
        cancellationReason: order.cancellationReason,
        cancelledAt: order.cancelledAt
      }
    });

  } catch (error) {
    console.error('❌ CANCEL ORDER ERROR:', error);
    res.status(400).json({ 
      success: false,
      message: error.message || 'Failed to cancel order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Delete order (hard delete - admin only)
const deleteOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    
    console.log('🗑️ DELETE ORDER - Order ID:', id, 'Admin:', req.user?.role);

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    // Delete order items first (due to foreign key constraints)
    await OrderItem.destroy({ 
      where: { orderId: id },
      transaction
    });

    // Delete order
    await order.destroy({ transaction });

    await transaction.commit();
    console.log('✅ Order deleted successfully');

    // Notify CRM
    try {
      await axios.delete(`https://crm-api.example.com/orders/${id}`, {
        data: { deletedBy: req.user.id, deletedAt: new Date() },
        timeout: 5000
      });
    } catch (crmError) {
      console.error('❌ CRM deletion notification failed:', crmError.message);
    }

    res.json({
      success: true,
      message: 'Order deleted successfully',
      deletedOrderId: parseInt(id)
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ DELETE ORDER ERROR:', error);
    res.status(400).json({ 
      success: false,
      message: error.message || 'Failed to delete order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get order statistics (for dashboard)
const getOrderStats = async (req, res) => {
  try {
    const userId = req.user.role === 'Admin' || req.user.role === 'Manager' ? null : req.user.id;
    const whereClause = userId ? { userId } : {};

    // Get basic counts
    const totalOrders = await Order.count({ where: whereClause });
    const pendingOrders = await Order.count({ where: { ...whereClause, status: 'Pending' } });
    const completedOrders = await Order.count({ where: { ...whereClause, status: 'Completed' } });
    const cancelledOrders = await Order.count({ where: { ...whereClause, status: 'Cancelled' } });

    // Get total order value
    const totalValue = await Order.sum('total', { where: whereClause }) || 0;
    const thisMonthValue = await Order.sum('total', { 
      where: { 
        ...whereClause,
        orderDate: {
          [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      } 
    }) || 0;

    // Get recent orders
    const recentOrders = await Order.findAll({
      where: whereClause,
      order: [['orderDate', 'DESC']],
      limit: 5,
      attributes: ['id', 'status', 'total', 'orderDate', 'paymentStatus'],
      include: [{
        model: User,
        as: 'User',
        attributes: ['name', 'email']
      }]
    });

    res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        totalValue: parseFloat(totalValue.toFixed(2)),
        thisMonthValue: parseFloat(thisMonthValue.toFixed(2)),
        averageOrderValue: totalOrders > 0 ? parseFloat((totalValue / totalOrders).toFixed(2)) : 0
      },
      recentOrders: recentOrders.map(order => ({
        id: order.id,
        status: order.status,
        total: parseFloat(order.total),
        orderDate: order.orderDate,
        paymentStatus: order.paymentStatus,
        customerName: order.User ? order.User.name : 'Unknown'
      }))
    });

  } catch (error) {
    console.error('❌ GET ORDER STATS ERROR:', error);
    res.status(400).json({ 
      success: false,
      message: error.message || 'Failed to fetch order statistics',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
  deleteOrder,
  getOrderStats
};
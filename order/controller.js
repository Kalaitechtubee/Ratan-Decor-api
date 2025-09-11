const { Order, OrderItem, Product, Cart, User, Category, ShippingAddress, sequelize } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
const {
  processOrderProductData,
  calculateUserPrice,
  processJsonField,
  getFallbackImageUrl,
} = require('../utils/imageUtils');

// Normalize payment method
const normalizePaymentMethod = (method) => {
  const m = (method || '').toString().toLowerCase();
  if (m === 'gateway') return 'Gateway';
  if (['upi', 'gpay', 'googlepay', 'phonepe', 'paytm', 'bhim', 'qr'].includes(m)) return 'UPI';
  if (['bank', 'banktransfer', 'bank_transfer', 'neft', 'imps', 'rtgs'].includes(m)) return 'BankTransfer';
  if (['cod', 'cash', 'cashondelivery'].includes(m)) return 'COD';
  return method;
};

// Validate address data
const validateAddressData = (addressData) => {
  const requiredFields = ['name', 'phone', 'address', 'city', 'state', 'country', 'pincode'];
  return requiredFields.every(field => 
    addressData[field] && typeof addressData[field] === 'string' && addressData[field].trim() !== ''
  );
};

// Prepare order address
const prepareOrderAddress = async (req, addressType, shippingAddressId, newAddressData) => {
  let orderAddress = null;
  
  if (addressType === 'new' && newAddressData) {
    // Map the fields correctly for ShippingAddress model
    const addressData = {
      name: newAddressData.name,
      phone: newAddressData.phone,
      address: newAddressData.address || newAddressData.street, // Handle both field names
      city: newAddressData.city,
      state: newAddressData.state,
      country: newAddressData.country,
      pincode: newAddressData.pincode || newAddressData.postalCode, // Handle both field names
      addressType: newAddressData.addressType || newAddressData.type || 'Home'
    };

    // Validate required fields
    const requiredFields = ['name', 'phone', 'address', 'city', 'state', 'country', 'pincode'];
    const missingFields = requiredFields.filter(field =>
      !addressData[field] || typeof addressData[field] !== 'string' || addressData[field].trim() === ''
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing required address fields: ${missingFields.join(', ')}`);
    }
    
    // Create new address using the ShippingAddress model
    const { ShippingAddress } = require('../models');

    const newAddress = await ShippingAddress.create({
      userId: req.user.id,
      ...addressData
    });
    
    orderAddress = {
      type: 'new',
      shippingAddressId: newAddress.id,
      addressData: {
        name: newAddress.name,
        phone: newAddress.phone,
        address: newAddress.address, // Use correct field name
        city: newAddress.city,
        state: newAddress.state,
        country: newAddress.country,
        pincode: newAddress.pincode, // Use correct field name
        addressType: newAddress.addressType,
        isDefault: false
      }
    };
  } else if ((addressType === 'shipping' || shippingAddressId) && shippingAddressId) {
    // Use ShippingAddress model for orders
    const { ShippingAddress } = require('../models');

    const shippingAddress = await ShippingAddress.findOne({
      where: {
        id: shippingAddressId,
        userId: req.user.id
      }
    });
    
    if (!shippingAddress) {
      throw new Error(`Shipping address with ID ${shippingAddressId} not found or doesn't belong to user`);
    }
    
    orderAddress = {
      type: 'shipping',
      shippingAddressId: shippingAddress.id,
      addressData: {
        name: shippingAddress.name || 'N/A',
        phone: shippingAddress.phone || 'N/A',
        address: shippingAddress.address, // Use correct field name
        city: shippingAddress.city,
        state: shippingAddress.state,
        country: shippingAddress.country,
        pincode: shippingAddress.pincode, // Use correct field name
        addressType: shippingAddress.addressType, // Use correct field name
        isDefault: false
      }
    };
  } else {
    // Fallback to user profile address
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'mobile', 'address', 'city', 'state', 'country', 'pincode']
    });
    
    const hasUsableProfileAddress = !!(user && user.address && user.city && user.state && user.country && user.pincode);
    
    if (hasUsableProfileAddress && (addressType === 'default' || !shippingAddressId)) {
      orderAddress = {
        type: 'default',
        shippingAddressId: null,
        addressData: {
          name: user.name,
          phone: user.mobile || 'Not provided',
          address: user.address,
          city: user.city,
          state: user.state,
          country: user.country,
          pincode: user.pincode,
          addressType: 'Default',
          isDefault: true,
          source: 'user_profile'
        }
      };
    } else {
      // Try to find any shipping address for this user
      const { ShippingAddress } = require('../models');

      const anyAddress = await ShippingAddress.findOne({
        where: { userId: req.user.id }
      });
      
      if (!anyAddress) {
        if (hasUsableProfileAddress) {
          // Fallback to user profile
          orderAddress = {
            type: 'default',
            shippingAddressId: null,
            addressData: {
              name: user.name,
              phone: user.mobile || 'Not provided',
              address: user.address,
              city: user.city,
              state: user.state,
              country: user.country,
              pincode: user.pincode,
              addressType: 'Default',
              isDefault: true,
              source: 'user_profile_fallback'
            }
          };
        } else {
          throw new Error('No complete address available. Please provide a new address or update your profile.');
        }
      } else {
        orderAddress = {
          type: 'shipping',
          shippingAddressId: anyAddress.id,
          addressData: {
            name: anyAddress.name || user.name,
            phone: anyAddress.phone || user.mobile || 'Not provided',
            address: anyAddress.address, // Use correct field name
            city: anyAddress.city,
            state: anyAddress.state,
            country: anyAddress.country,
            pincode: anyAddress.pincode, // Use correct field name
            addressType: anyAddress.addressType, // Use correct field name
            isDefault: false,
            source: 'address_fallback'
          }
        };
      }
    }
  }
  
  return orderAddress;
};

// CREATE ORDER
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    console.log('📦 CREATE ORDER - User:', req.user?.id, 'Role:', req.user?.role);

    const {
      paymentMethod,
      items,
      shippingAddressId,
      addressType = 'default',
      newAddressData,
      notes,
      expectedDeliveryDate
    } = req.body;

    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    if (!['Gateway', 'UPI', 'BankTransfer', 'COD'].includes(normalizedPaymentMethod)) {
      throw new Error('Valid payment method is required (Gateway, UPI, BankTransfer, COD)');
    }

    if (!['default', 'shipping', 'new'].includes(addressType)) {
      throw new Error('Address type must be "default", "shipping", or "new"');
    }

    let orderAddress = await prepareOrderAddress(req, addressType, shippingAddressId, newAddressData);

    let orderItems = [];
    if (items && items.length > 0) {
      orderItems = items;
    } else {
      const cartItems = await Cart.findAll({
        where: { userId: req.user.id },
        include: [{
          model: Product,
          as: 'product',
          where: { isActive: true },
          required: true,
          include: [{ 
            model: Category, 
            as: 'category', 
            attributes: ['id', 'name', 'parentId'], 
            required: false 
          }],
          attributes: [
            'id', 'name', 'description',
            'image', 'images',
            'generalPrice', 'dealerPrice', 'architectPrice',
            'isActive', 'colors', 'specifications'
            // Removed 'features' and 'dimensions' from here
          ]
        }]
      });

      if (cartItems.length === 0) {
        throw new Error('No items found in cart or provided');
      }

      orderItems = cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        product: item.product
      }));
    }

    let subtotal = 0;
    const processedOrderItems = [];

    for (const item of orderItems) {
      const product = item.product || await Product.findByPk(item.productId, {
        include: [{ 
          model: Category, 
          as: 'category', 
          attributes: ['id', 'name', 'parentId'], 
          required: false 
        }],
        attributes: [
          'id', 'name', 'description',
          'image', 'images',
          'generalPrice', 'dealerPrice', 'architectPrice',
          'isActive', 'colors', 'specifications'
          // Removed 'features' and 'dimensions' from here
        ]
      });

      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }

      if (!product.isActive) {
        throw new Error(`Product "${product.name}" is not available`);
      }

      const unitPrice = calculateUserPrice(product, req.user.role);
      const quantity = parseInt(item.quantity);
      const itemSubtotal = unitPrice * quantity;
      subtotal += itemSubtotal;

      const processedProduct = processOrderProductData(product, req, req.user.role);

      processedOrderItems.push({
        productId: product.id,
        quantity: quantity,
        price: unitPrice,
        subtotal: itemSubtotal,
        total: itemSubtotal,
        product: {
          id: product.id,
          name: product.name,
          imageUrl: processedProduct.imageUrl || getFallbackImageUrl(req),
          imageUrls: processedProduct.imageUrls || [],
          currentPrice: unitPrice,
          isActive: product.isActive,
          colors: processedProduct.colors || [],
          specifications: processedProduct.specifications || {},
          category: product.category ? {
            id: product.category.id,
            name: product.category.name,
            parentId: product.category.parentId
          } : null
        }
      });
    }

    const finalTotal = subtotal;

    const order = await Order.create({
      userId: req.user.id,
      paymentMethod: normalizedPaymentMethod,
      total: parseFloat(finalTotal.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      paymentStatus: normalizedPaymentMethod === 'COD' ? 'Awaiting' : 'Awaiting',
      status: 'Pending',
      shippingAddressId: orderAddress.shippingAddressId,
      deliveryAddressType: orderAddress.type,
      deliveryAddressData: orderAddress.addressData,
      notes: notes || null,
      expectedDeliveryDate: expectedDeliveryDate || null,
      orderDate: new Date()
    }, { transaction });

    const orderItemsData = processedOrderItems.map(item => ({
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      subtotal: parseFloat(item.subtotal.toFixed(2)),
      total: parseFloat(item.total.toFixed(2))
    }));

    await OrderItem.bulkCreate(orderItemsData, { transaction });

    if (!items || items.length === 0) {
      await Cart.destroy({ where: { userId: req.user.id }, transaction });
    }

    try {
      await axios.post('https://crm-api.example.com/orders', {
        orderId: order.id,
        userId: req.user.id,
        userRole: req.user.role,
        total: finalTotal,
        subtotal: subtotal,
        itemCount: processedOrderItems.length,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderDate: order.orderDate,
        deliveryAddress: orderAddress.addressData
      }, { timeout: 5000 });
    } catch (crmError) {
      console.error('CRM integration failed:', crmError.message);
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        total: parseFloat(order.total),
        subtotal: parseFloat(order.subtotal),
        itemCount: processedOrderItems.length,
        orderDate: order.orderDate,
        expectedDeliveryDate: order.expectedDeliveryDate,
        deliveryAddress: {
          type: orderAddress.type,
          data: orderAddress.addressData
        },
        orderItems: processedOrderItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: parseFloat(item.price),
          subtotal: parseFloat(item.subtotal),
          total: parseFloat(item.total),
          product: item.product
        })),
        redirectToPayment: normalizedPaymentMethod === 'Gateway'
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('CREATE ORDER ERROR:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// GET ORDERS
const getOrders = async (req, res) => {
  try {
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

    const where = req.user.role === 'Admin' || req.user.role === 'Manager' ? {} : { userId: req.user.id };

    if (status) {
      where.status = Array.isArray(status) ? { [Op.in]: status } : status;
    }
    if (paymentStatus) {
      where.paymentStatus = Array.isArray(paymentStatus) ? { [Op.in]: paymentStatus } : paymentStatus;
    }
    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate[Op.gte] = new Date(startDate);
      if (endDate) where.orderDate[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'orderItems',
          include: [{
            model: Product,
            as: 'product',
            attributes: [
              'id', 'name', 'description',
              'image', 'images',
              'generalPrice', 'dealerPrice', 'architectPrice',
              'isActive', 'colors', 'specifications'
              // Removed 'features' and 'dimensions'
            ],
            include: [{ 
              model: Category, 
              as: 'category', 
              attributes: ['id', 'name', 'parentId'], 
              required: false 
            }]
          }]
        },
        { 
          model: ShippingAddress, 
          as: 'shippingAddress', 
          required: false 
        },
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'name', 'email', 'role', 'mobile', 'address', 'city', 'state', 'country', 'pincode'], 
          required: false 
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: Number(limit),
      offset: Number(offset)
    });

    const processedOrders = orders.map(order => {
      const orderData = order.toJSON();

      let deliveryAddress = null;
      if (orderData.deliveryAddressData) {
        try {
          deliveryAddress = {
            type: orderData.deliveryAddressType || 'unknown',
            data: typeof orderData.deliveryAddressData === 'string'
              ? JSON.parse(orderData.deliveryAddressData)
              : orderData.deliveryAddressData
          };
        } catch (e) {
          console.warn('Failed to parse delivery address data:', e);
        }
      }

      if (!deliveryAddress) {
        if (orderData.shippingAddress) {
          deliveryAddress = {
            type: 'shipping',
            data: {
              name: orderData.shippingAddress.name,
              phone: orderData.shippingAddress.phone,
              address: orderData.shippingAddress.address,
              city: orderData.shippingAddress.city,
              state: orderData.shippingAddress.state,
              country: orderData.shippingAddress.country,
              pincode: orderData.shippingAddress.pincode,
              addressType: orderData.shippingAddress.addressType
            }
          };
        } else if (orderData.user) {
          deliveryAddress = {
            type: 'default',
            data: {
              name: orderData.user.name,
              phone: orderData.user.mobile || 'Not provided',
              address: orderData.user.address,
              city: orderData.user.city,
              state: orderData.user.state,
              country: orderData.user.country,
              pincode: orderData.user.pincode,
              source: 'user_profile'
            }
          };
        }
      }

      orderData.deliveryAddress = deliveryAddress;

      if (orderData.orderItems) {
        orderData.orderItems = orderData.orderItems.map(item => {
          const itemData = { ...item };
          if (item.product) {
            const processedProduct = processOrderProductData(item.product, req, req.user.role);
            
            itemData.product = {
              id: item.product.id,
              name: item.product.name,
              imageUrl: processedProduct.imageUrl || getFallbackImageUrl(req),
              imageUrls: processedProduct.imageUrls || [],
              currentPrice: calculateUserPrice(item.product, req.user.role),
              orderPrice: parseFloat(item.price),
              priceChange: parseFloat((calculateUserPrice(item.product, req.user.role) - item.price).toFixed(2)),
              isActive: item.product.isActive,
              colors: processedProduct.colors || [],
              specifications: processedProduct.specifications || {},
              category: item.product.category ? {
                id: item.product.category.id,
                name: item.product.category.name,
                parentId: item.product.category.parentId
              } : null
            };
          }
          return itemData;
        });
      }

      return orderData;
    });

    const orderSummary = {
      totalOrders: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      ordersPerPage: Number(limit),
      statusBreakdown: {},
      paymentStatusBreakdown: {}
    };

    const statusStats = await Order.findAll({
      where: req.user.role === 'Admin' || req.user.role === 'Manager' ? {} : { userId: req.user.id },
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

    const paymentStats = await Order.findAll({
      where: req.user.role === 'Admin' || req.user.role === 'Manager' ? {} : { userId: req.user.id },
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

    res.json({
      success: true,
      orders: processedOrders,
      orderSummary: orderSummary,
      filters: { status, paymentStatus, startDate, endDate },
      pagination: { 
        page: Number(page), 
        limit: Number(limit), 
        total: count, 
        totalPages: Math.ceil(count / limit) 
      },
      sorting: { sortBy, sortOrder }
    });

  } catch (error) {
    console.error('GET ORDERS ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// GET ORDER BY ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      where: {
        id: id,
        ...(req.user.role === 'Admin' || req.user.role === 'Manager' ? {} : { userId: req.user.id })
      },
      include: [
        {
          model: OrderItem,
          as: 'orderItems',
          include: [{
            model: Product,
            as: 'product',
            attributes: [
              'id', 'name', 'description',
              'image', 'images',
              'generalPrice', 'dealerPrice', 'architectPrice',
              'isActive', 'colors', 'specifications'
              // Removed 'features' and 'dimensions'
            ],
            include: [{ 
              model: Category, 
              as: 'category', 
              attributes: ['id', 'name', 'parentId'], 
              required: false 
            }]
          }],
          required: false
        },
        {
          model: ShippingAddress,
          as: 'shippingAddress',
          attributes: ['id', 'name', 'phone', 'address', 'city', 'state', 'country', 'pincode', 'addressType', 'isDefault'],
          required: false
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'role', 'mobile', 'company', 'address', 'city', 'state', 'country', 'pincode'],
          required: false
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const orderData = order.toJSON();

    let deliveryAddress = null;
    if (orderData.deliveryAddressData) {
      try {
        deliveryAddress = {
          type: orderData.deliveryAddressType || 'unknown',
          data: typeof orderData.deliveryAddressData === 'string'
            ? JSON.parse(orderData.deliveryAddressData)
            : orderData.deliveryAddressData
        };
      } catch (e) {
        console.warn(`Failed to parse delivery address data for order ${orderData.id}:`, e);
      }
    }

    if (!deliveryAddress) {
      if (orderData.shippingAddress) {
        deliveryAddress = {
          type: 'shipping',
          data: {
            id: orderData.shippingAddress.id,
            name: orderData.shippingAddress.name,
            phone: orderData.shippingAddress.phone,
            address: orderData.shippingAddress.address,
            city: orderData.shippingAddress.city,
            state: orderData.shippingAddress.state,
            country: orderData.shippingAddress.country,
            pincode: orderData.shippingAddress.pincode,
            addressType: orderData.shippingAddress.addressType,
            isDefault: orderData.shippingAddress.isDefault
          }
        };
      } else if (orderData.user && orderData.user.address && orderData.user.city && orderData.user.state && orderData.user.country && orderData.user.pincode) {
        deliveryAddress = {
          type: 'default',
          data: {
            name: orderData.user.name,
            phone: orderData.user.mobile || 'Not provided',
            address: orderData.user.address,
            city: orderData.user.city,
            state: orderData.user.state,
            country: orderData.user.country,
            pincode: orderData.user.pincode,
            source: 'user_profile'
          }
        };
      } else {
        deliveryAddress = { type: 'none', data: null };
      }
    }

    orderData.orderItems = (orderData.orderItems || []).map(item => {
      const itemData = { ...item };
      if (item.product) {
        const processedProduct = processOrderProductData(item.product, req, req.user.role);
        
        itemData.product = {
          id: item.product.id,
          name: item.product.name,
          description: item.product.description || null,
          imageUrl: processedProduct.imageUrl || getFallbackImageUrl(req),
          imageUrls: processedProduct.imageUrls || [],
          currentPrice: calculateUserPrice(item.product, req.user.role),
          orderPrice: parseFloat(item.price),
          priceChange: parseFloat((calculateUserPrice(item.product, req.user.role) - item.price).toFixed(2)),
          isActive: item.product.isActive,
          colors: processedProduct.colors || [],
          specifications: processedProduct.specifications || [],
          // Removed features and dimensions references
          category: item.product.category ? {
            id: item.product.category.id,
            name: item.product.category.name,
            parentId: item.product.category.parentId
          } : null
        };
      } else {
        itemData.product = {
          id: item.productId,
          name: 'Unknown Product',
          imageUrl: getFallbackImageUrl(req),
          imageUrls: [],
          currentPrice: parseFloat(item.price),
          orderPrice: parseFloat(item.price),
          priceChange: 0,
          isActive: false,
          category: null
        };
      }
      return itemData;
    });

    res.json({
      success: true,
      order: {
        id: orderData.id,
        userId: orderData.userId,
        status: orderData.status,
        paymentStatus: orderData.paymentStatus,
        paymentMethod: orderData.paymentMethod,
        total: parseFloat(orderData.total),
        subtotal: parseFloat(orderData.subtotal),
        orderDate: orderData.orderDate,
        expectedDeliveryDate: orderData.expectedDeliveryDate,
        notes: orderData.notes,
        deliveryAddress,
        orderItems: orderData.orderItems
      }
    });

  } catch (error) {
    console.error('GET ORDER BY ID ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// UPDATE ORDER
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus, notes, expectedDeliveryDate } = req.body;
    
    console.log('UPDATE ORDER - Order ID:', id, 'User Role:', req.user?.role);
    
    const order = await Order.findOne({
      where: {
        id: id,
        ...(req.user.role === 'Admin' || req.user.role === 'Manager' ? {} : { userId: req.user.id })
      }
    });
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const updateData = {};
    
    if (req.user.role === 'Admin' || req.user.role === 'Manager') {
      if (status !== undefined) updateData.status = status;
      if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
      if (notes !== undefined) updateData.notes = notes;
      if (expectedDeliveryDate !== undefined) updateData.expectedDeliveryDate = expectedDeliveryDate;
    } else {
      if (notes !== undefined) updateData.notes = notes;
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }
    
    if (status && order.status !== status) {
      const validTransitions = {
        'Pending': ['Processing', 'Cancelled'],
        'Processing': ['Shipped', 'Cancelled'],
        'Shipped': ['Completed'],
        'Completed': [],
        'Cancelled': []
      };
      
      if (!validTransitions[order.status]?.includes(status)) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot change order status from ${order.status} to ${status}` 
        });
      }
    }
    
    await order.update(updateData);
    
    try {
      await axios.put(`https://crm-api.example.com/orders/${id}`, {
        orderId: id,
        ...updateData,
        updatedBy: req.user.id,
        updatedByRole: req.user.role,
        updatedAt: new Date()
      }, { timeout: 5000 });
    } catch (crmError) {
      console.error('CRM update failed:', crmError.message);
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
        updatedAt: order.updatedAt
      }
    });
    
  } catch (error) {
    console.error('UPDATE ORDER ERROR:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// CANCEL ORDER
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    console.log('CANCEL ORDER - Order ID:', id, 'User ID:', req.user?.id, 'User Role:', req.user?.role);

    // Staff users can cancel any order, regular users can only cancel their own orders
    let whereCondition = { id: id };
    if (!['Admin', 'SuperAdmin', 'Manager', 'Sales', 'Support'].includes(req.user.role)) {
      whereCondition.userId = req.user.id;
    }

    const order = await Order.findOne({
      where: whereCondition
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    if (!['Pending', 'Processing'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot cancel order with status: ${order.status}` 
      });
    }
    
    await order.update({
      status: 'Cancelled'
    });
    
    try {
      await axios.put(`https://crm-api.example.com/orders/${id}/cancel`, {
        orderId: id,
        reason: reason || 'Cancelled by user',
        cancelledBy: req.user.id,
        cancelledAt: new Date()
      }, { timeout: 5000 });
    } catch (crmError) {
      console.error('CRM cancellation notification failed:', crmError.message);
    }
    
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        id: order.id,
        status: order.status
      }
    });
    
  } catch (error) {
    console.error('CANCEL ORDER ERROR:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to cancel order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// DELETE ORDER
const deleteOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    
    console.log('DELETE ORDER - Order ID:', id, 'Admin:', req.user?.role);
    
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    await OrderItem.destroy({ where: { orderId: id }, transaction });
    await order.destroy({ transaction });
    
    await transaction.commit();
    
    try {
      await axios.delete(`https://crm-api.example.com/orders/${id}`, {
        data: { deletedBy: req.user.id, deletedAt: new Date() },
        timeout: 5000
      });
    } catch (crmError) {
      console.error('CRM deletion notification failed:', crmError.message);
    }
    
    res.json({
      success: true,
      message: 'Order deleted successfully',
      deletedOrderId: parseInt(id)
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('DELETE ORDER ERROR:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// GET ORDER STATS
const getOrderStats = async (req, res) => {
  try {
    const userId = req.user.role === 'Admin' || req.user.role === 'Manager' ? null : req.user.id;
    const whereClause = userId ? { userId } : {};
    
    const totalOrders = await Order.count({ where: whereClause });
    const pendingOrders = await Order.count({ where: { ...whereClause, status: 'Pending' } });
    const completedOrders = await Order.count({ where: { ...whereClause, status: 'Completed' } });
    const cancelledOrders = await Order.count({ where: { ...whereClause, status: 'Cancelled' } });
    
    const totalValue = await Order.sum('total', { where: whereClause }) || 0;
    const thisMonthValue = await Order.sum('total', {
      where: {
        ...whereClause,
        orderDate: { [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      }
    }) || 0;
    
    const recentOrders = await Order.findAll({
      where: whereClause,
      order: [['orderDate', 'DESC']],
      limit: 5,
      attributes: ['id', 'status', 'total', 'orderDate', 'paymentStatus'],
      include: [{ model: User, as: 'user', attributes: ['name', 'email'] }]
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
        customerName: order.user ? order.user.name : 'Unknown'
      }))
    });
    
  } catch (error) {
    console.error('GET ORDER STATS ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order statistics',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Also update the getAvailableAddresses function to be consistent
const getAvailableAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'mobile', 'address', 'city', 'state', 'country', 'pincode']
    });
    
    // Use consistent Address model
    const { Address } = require('../models');
    
    const addresses = await Address.findAll({
      where: { userId }
    });
    
    const availableAddresses = {
      defaultAddress: null,
      shippingAddresses: addresses.map(addr => ({
        id: addr.id,
        name: addr.name,
        phone: addr.phone,
        address: addr.address, // Use correct field name
        city: addr.city,
        state: addr.state,
        country: addr.country,
        pincode: addr.pincode, // Use correct field name
        addressType: addr.addressType, // Use correct field name
        isDefault: false // Your Address model might not have isDefault
      }))
    };
    
    if (user && user.address && user.city && user.state && user.country && user.pincode) {
      availableAddresses.defaultAddress = {
        type: 'default',
        name: user.name,
        phone: user.mobile || 'Not provided',
        address: user.address,
        city: user.city,
        state: user.state,
        country: user.country,
        pincode: user.pincode,
        source: 'user_profile'
      };
    }
    
    res.json({
      success: true,
      message: 'Available addresses fetched successfully',
      addresses: availableAddresses,
      summary: {
        hasDefaultAddress: !!availableAddresses.defaultAddress,
        totalAddresses: addresses.length
      }
    });
    
  } catch (error) {
    console.error('GET AVAILABLE ADDRESSES ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch available addresses',
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
  getOrderStats,
  getAvailableAddresses
};
const { Order, OrderItem, Product, Cart, User, Category, ShippingAddress, sequelize } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
const {
  processOrderProductData,
  calculateUserPrice,
  processJsonField,
  getFallbackImageUrl,
} = require('../utils/imageUtils');

const normalizePaymentMethod = (method) => {
  const m = (method || '').toString().toLowerCase();
  if (m === 'gateway') return 'Gateway';
  if (['upi', 'gpay', 'googlepay', 'phonepe', 'paytm', 'bhim', 'qr'].includes(m)) return 'UPI';
  if (['bank', 'banktransfer', 'bank_transfer', 'neft', 'imps', 'rtgs'].includes(m)) return 'BankTransfer';
  if (['cod', 'cash', 'cashondelivery'].includes(m)) return 'COD';
  return method;
};

const validateAddressData = (addressData) => {
  const requiredFields = ['name', 'phone', 'address', 'city', 'state', 'country', 'pincode'];
  return requiredFields.every(field =>
    addressData[field] && typeof addressData[field] === 'string' && addressData[field].trim() !== ''
  );
};

const prepareOrderAddress = async (req, addressType, shippingAddressId, newAddressData) => {
  let orderAddress = null;

  if (addressType === 'new' && newAddressData) {

    const addressData = {
      name: newAddressData.name,
      phone: newAddressData.phone,
      address: newAddressData.address || newAddressData.street,
      city: newAddressData.city,
      state: newAddressData.state,
      country: newAddressData.country,
      pincode: newAddressData.pincode || newAddressData.postalCode,
      addressType: newAddressData.addressType || newAddressData.type || 'Home'
    };

    const requiredFields = ['name', 'phone', 'address', 'city', 'state', 'country', 'pincode'];
    const missingFields = requiredFields.filter(field =>
      !addressData[field] || typeof addressData[field] !== 'string' || addressData[field].trim() === ''
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing required address fields: ${missingFields.join(', ')}`);
    }


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
        address: newAddress.address,
        city: newAddress.city,
        state: newAddress.state,
        country: newAddress.country,
        pincode: newAddress.pincode,
        addressType: newAddress.addressType,
        isDefault: false
      }
    };
  } else if ((addressType === 'shipping' || shippingAddressId) && shippingAddressId) {

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
        address: shippingAddress.address,
        city: shippingAddress.city,
        state: shippingAddress.state,
        country: shippingAddress.country,
        pincode: shippingAddress.pincode,
        addressType: shippingAddress.addressType,
        isDefault: false
      }
    };
  } else {

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
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required to create order' });
  }

  const transaction = await sequelize.transaction();
  try {
    console.log('📦 CREATE ORDER - User:', req.user.id, 'Role:', req.user.role);

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

    // Prepare delivery address (may create new ShippingAddress)
    const orderAddress = await prepareOrderAddress(req, addressType, shippingAddressId, newAddressData);

    // Build items list: prefer `items` from body, otherwise use cart items
    let itemsToProcess = [];
    if (Array.isArray(items) && items.length > 0) {
      itemsToProcess = items.map(it => ({ productId: it.productId || it.id, quantity: Number(it.quantity || 1) }));
    } else {
      const cartItems = await Cart.findAll({ where: { userId: req.user.id }, include: [{ model: Product, as: 'product' }], transaction });
      itemsToProcess = cartItems.map(ci => ({ productId: ci.productId, quantity: Number(ci.quantity || 1), product: ci.product }));
    }

    if (!itemsToProcess || itemsToProcess.length === 0) {
      throw new Error('No items provided to create order');
    }

    // Load products for any items missing product data
    const productIds = itemsToProcess.map(i => i.productId);
    const products = await Product.findAll({ where: { id: productIds }, include: [{ model: Category, as: 'category' }], transaction });
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    // Calculate totals
    let subtotal = 0;
    let totalGst = 0;

    const processedOrderItems = [];
    for (const it of itemsToProcess) {
      const product = it.product || productMap[it.productId];
      if (!product) throw new Error(`Product not found: ${it.productId}`);

      const unitPrice = calculateUserPrice(product, req.user.role);
      const qty = Number(it.quantity || 1);
      const itemSubtotal = parseFloat((unitPrice * qty).toFixed(2));
      const gstRate = parseFloat(product.gst || 0) || 0;
      const itemGst = parseFloat(((itemSubtotal * gstRate) / 100).toFixed(2));
      const itemTotal = parseFloat((itemSubtotal + itemGst).toFixed(2));

      subtotal += itemSubtotal;
      totalGst += itemGst;

      processedOrderItems.push({
        productId: product.id,
        quantity: qty,
        price: unitPrice,
        subtotal: itemSubtotal,
        gstAmount: itemGst,
        total: itemTotal,
        product
      });
    }

    subtotal = parseFloat(subtotal.toFixed(2));
    totalGst = parseFloat(totalGst.toFixed(2));
    const total = parseFloat((subtotal + totalGst).toFixed(2));

    // Create Order
    const order = await Order.create({
      userId: req.user.id,
      paymentMethod: normalizedPaymentMethod || 'Gateway',
      total,
      subtotal,
      gstAmount: totalGst,
      shippingAddressId: orderAddress && orderAddress.shippingAddressId ? orderAddress.shippingAddressId : null,
      deliveryAddressType: orderAddress ? orderAddress.type : 'default',
      deliveryAddressData: orderAddress ? orderAddress.addressData : null,
      notes: notes || null,
      expectedDeliveryDate: expectedDeliveryDate || null
    }, { transaction });

    // Create OrderItems
    for (const poi of processedOrderItems) {
      await OrderItem.create({
        orderId: order.id,
        productId: poi.productId,
        quantity: poi.quantity,
        price: poi.price,
        subtotal: poi.subtotal,
        gstAmount: poi.gstAmount,
        total: poi.total
      }, { transaction });
    }

    // Clear user's cart for the ordered products
    try {
      await Cart.destroy({ where: { userId: req.user.id, productId: productIds }, transaction });
    } catch (e) {
      // non-fatal: log and continue
      console.warn('Failed to clear cart items after order creation:', e && e.message ? e.message : e);
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
    try {
      if (transaction && !['commit', 'rollback'].includes(transaction.finished)) {
        await transaction.rollback();
      }
    } catch (rbErr) {
      console.warn('Transaction rollback skipped or failed:', rbErr && rbErr.message ? rbErr.message : rbErr);
    }

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
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required to view orders' });
  }

  // Role-based access control based on permissions table
  const userRole = req.user.role;
  if (userRole === 'Support') {
    return res.status(403).json({ success: false, message: 'Access denied to Orders module' });
  }

  try {
    const currentUserId = req.user.id;

    const {
      status,
      paymentStatus,
      customer,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'orderDate',
      sortOrder = 'DESC',
      userId // For staff to filter by specific user
    } = req.query;

    const staffRoles = ['SuperAdmin', 'Admin', 'Sales'];
    const isStaff = staffRoles.includes(userRole);

    // For non-staff (e.g., customers), restrict to own orders and disallow customer search
    if (!isStaff) {
      if (customer) {
        return res.status(400).json({ success: false, message: 'Search by customer not allowed' });
      }
      if (userId && parseInt(userId) !== currentUserId) {
        return res.status(403).json({ success: false, message: 'You can only view your own orders' });
      }
    }

    let targetUserId = null;
    if (isStaff && userId) {
      targetUserId = parseInt(userId);
    } else if (!isStaff) {
      targetUserId = currentUserId;
    }
    // For staff without userId, view all orders

    // DEBUG: Log user filtering info
    console.log('📋 GET ORDERS DEBUG:', {
      currentUserId,
      userRole,
      isStaff,
      requestedUserId: userId || null,
      targetUserId,
      willFilterByUser: !!targetUserId
    });

    // Initialize where clause
    const where = {};

    // Only filter by user ID if specified
    if (targetUserId) {
      where.userId = targetUserId;
    }

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

    const userInclude = {
      model: User,
      as: 'user',
      attributes: ['id', 'name', 'email', 'role', 'state', 'city', 'pincode', 'address', 'country', 'mobile'],
      where: isStaff && customer ? sequelize.where(sequelize.fn('LOWER', sequelize.col('user.name')), { [Op.like]: `%${customer.toLowerCase()}%` }) : undefined,
      required: !!(isStaff && customer)
    };

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
        userInclude
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
        const fallbackImageUrl = getFallbackImageUrl(req);
        orderData.orderItems = orderData.orderItems.map(item => {
          const itemData = { ...item };
          if (item.product) {
            const processedProduct = processOrderProductData(item.product, req, userRole);

            // Ensure imageUrl and imageUrls are always set, even if processedProduct is null
            const imageUrl = processedProduct?.imageUrl || fallbackImageUrl;
            const imageUrls = processedProduct?.imageUrls && processedProduct.imageUrls.length > 0
              ? processedProduct.imageUrls
              : [fallbackImageUrl];

            itemData.product = {
              id: item.product.id,
              name: item.product.name,
              imageUrl: imageUrl,
              imageUrls: imageUrls,
              currentPrice: calculateUserPrice(item.product, userRole),
              orderPrice: parseFloat(item.price),
              priceChange: parseFloat((calculateUserPrice(item.product, userRole) - item.price).toFixed(2)),
              isActive: item.product.isActive,
              colors: processedProduct?.colors || [],
              specifications: processedProduct?.specifications || {},
              category: item.product.category ? {
                id: item.product.category.id,
                name: item.product.category.name,
                parentId: item.product.category.parentId
              } : null
            };
          } else {
            // Handle case when product is missing
            itemData.product = {
              id: item.productId,
              name: 'Unknown Product',
              imageUrl: fallbackImageUrl,
              imageUrls: [fallbackImageUrl],
              currentPrice: parseFloat(item.price),
              orderPrice: parseFloat(item.price),
              priceChange: 0,
              isActive: false,
              category: null
            };
          }
          return itemData;
        });
      }

      return orderData;
    });

    // For stats, adjust to user-specific or all based on role
    let targetUserIdForStats = isStaff ? null : currentUserId;
    const whereForStats = targetUserIdForStats ? { userId: targetUserIdForStats } : {};

    const orderSummary = {
      totalOrders: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      ordersPerPage: Number(limit),
      statusBreakdown: {},
      paymentStatusBreakdown: {}
    };

    const statusStats = await Order.findAll({
      where: whereForStats,
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
      where: whereForStats,
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

      // User context - helps frontend know whose orders these are
      forUser: targetUserId ? {
        id: targetUserId,
        isFiltered: true
      } : {
        id: null,
        isFiltered: false,
        reason: 'Staff viewing all orders'
      },
      isStaffView: isStaff && !targetUserId,

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
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required to view order' });
  }

  // Role-based access control: Deny for Support
  if (req.user.role === 'Support') {
    return res.status(403).json({ success: false, message: 'Access denied to Orders module' });
  }

  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const userRole = req.user.role;
    const staffRoles = ['SuperAdmin', 'Admin', 'Sales'];
    const isStaff = staffRoles.includes(userRole);

    const where = { id };
    if (!isStaff) {
      where.userId = currentUserId;
    }

    const order = await Order.findOne({
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
      const fallbackImageUrl = getFallbackImageUrl(req);

      if (item.product) {
        const processedProduct = processOrderProductData(item.product, req, userRole);

        // Ensure imageUrl and imageUrls are always set, even if processedProduct is null
        const imageUrl = processedProduct?.imageUrl || fallbackImageUrl;
        const imageUrls = processedProduct?.imageUrls && processedProduct.imageUrls.length > 0
          ? processedProduct.imageUrls
          : [fallbackImageUrl];

        itemData.product = {
          id: item.product.id,
          name: item.product.name,
          description: item.product.description || null,
          imageUrl: imageUrl,
          imageUrls: imageUrls,
          currentPrice: calculateUserPrice(item.product, userRole),
          orderPrice: parseFloat(item.price),
          priceChange: parseFloat((calculateUserPrice(item.product, userRole) - item.price).toFixed(2)),
          isActive: item.product.isActive,
          colors: processedProduct?.colors || [],
          specifications: processedProduct?.specifications || {},
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
          imageUrl: fallbackImageUrl,
          imageUrls: [fallbackImageUrl],
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
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required to update order' });
  }

  // Role-based access control: Deny for Support
  if (req.user.role === 'Support') {
    return res.status(403).json({ success: false, message: 'Access denied to Orders module' });
  }

  try {
    const { id } = req.params;
    const { status, paymentStatus, notes, expectedDeliveryDate } = req.body;
    const currentUserId = req.user.id;
    const userRole = req.user.role;
    const staffRoles = ['SuperAdmin', 'Admin', 'Sales'];
    const isStaff = staffRoles.includes(userRole);

    console.log('UPDATE ORDER - Order ID:', id, 'User ID:', currentUserId, 'User Role:', userRole);

    const where = { id };
    if (!isStaff) {
      where.userId = currentUserId;
    }

    const order = await Order.findOne({ where });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const updateData = {};

    if (status !== undefined) updateData.status = status;
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (notes !== undefined) updateData.notes = notes;
    if (expectedDeliveryDate !== undefined) updateData.expectedDeliveryDate = expectedDeliveryDate;

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
        updatedBy: currentUserId,
        updatedByRole: userRole,
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
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required to cancel order' });
  }

  // Role-based access control: Deny for Support
  if (req.user.role === 'Support') {
    return res.status(403).json({ success: false, message: 'Access denied to Orders module' });
  }

  try {
    const { id } = req.params;
    const { reason } = req.body;
    const currentUserId = req.user.id;
    const userRole = req.user.role;
    const staffRoles = ['SuperAdmin', 'Admin', 'Sales'];
    const isStaff = staffRoles.includes(userRole);

    console.log('CANCEL ORDER - Order ID:', id, 'User ID:', currentUserId, 'User Role:', userRole);

    const where = { id };
    if (!isStaff) {
      where.userId = currentUserId;
    }

    const order = await Order.findOne({
      where
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
        cancelledBy: currentUserId,
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
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required to delete order' });
  }

  // Role-based access control: Deny for Support
  if (req.user.role === 'Support') {
    return res.status(403).json({ success: false, message: 'Access denied to Orders module' });
  }

  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const userRole = req.user.role;
    const staffRoles = ['SuperAdmin', 'Admin', 'Sales'];
    const isStaff = staffRoles.includes(userRole);

    console.log('DELETE ORDER - Order ID:', id, 'User ID:', currentUserId, 'Role:', userRole);

    const where = { id };
    if (!isStaff) {
      where.userId = currentUserId;
    }

    const order = await Order.findOne({
      where
    });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    await OrderItem.destroy({ where: { orderId: id }, transaction });
    await order.destroy({ transaction });

    await transaction.commit();

    try {
      await axios.delete(`https://crm-api.example.com/orders/${id}`, {
        data: { deletedBy: currentUserId, deletedAt: new Date() },
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
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required to view order stats' });
  }

  // Role-based access control: Deny for Support
  if (req.user.role === 'Support') {
    return res.status(403).json({ success: false, message: 'Access denied to Orders module' });
  }

  try {
    const currentUserId = req.user.id;
    const userRole = req.user.role;
    const staffRoles = ['SuperAdmin', 'Admin', 'Sales'];
    const isStaff = staffRoles.includes(userRole);

    const whereClause = isStaff ? {} : { userId: currentUserId };

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

    const recentOrdersWhere = { ...whereClause };
    const recentOrders = await Order.findAll({
      where: recentOrdersWhere,
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

// GET AVAILABLE ADDRESSES (updated for consistency with ShippingAddress model)
const getAvailableAddresses = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required to view addresses' });
  }

  // Role-based access control: Deny for Support (assuming addresses tied to Orders module)
  if (req.user.role === 'Support') {
    return res.status(403).json({ success: false, message: 'Access denied to Orders module' });
  }

  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'mobile', 'address', 'city', 'state', 'country', 'pincode']
    });

    const addresses = await ShippingAddress.findAll({
      where: { userId }
    });

    const availableAddresses = {
      defaultAddress: null,
      shippingAddresses: addresses.map(addr => ({
        id: addr.id,
        name: addr.name,
        phone: addr.phone,
        address: addr.address,
        city: addr.city,
        state: addr.state,
        country: addr.country,
        pincode: addr.pincode,
        addressType: addr.addressType,
        isDefault: addr.isDefault || false
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
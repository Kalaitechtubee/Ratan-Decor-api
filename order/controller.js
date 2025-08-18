const { Order, OrderItem, Product, Cart, User, Category, ShippingAddress, sequelize } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');

const getImageUrl = (filename, req) => {
  if (!filename) return null;
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  if (filename.startsWith('/uploads/')) return filename;
  const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
  return `${baseUrl}/uploads/products/${filename}`;
};

const processProductData = (product, req) => {
  const productData = product.toJSON ? product.toJSON() : product;
  if (productData.image) {
    productData.imageUrl = getImageUrl(productData.image, req);
  }
  if (productData.images && Array.isArray(productData.images)) {
    productData.imageUrls = productData.images.map(img => getImageUrl(img, req));
  } else {
    productData.imageUrls = [];
  }
  if (!Array.isArray(productData.colors)) {
    productData.colors = [];
  }
  if (!productData.specifications || typeof productData.specifications !== 'object') {
    productData.specifications = {};
  }
  return productData;
};

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
  return requiredFields.every(field => addressData[field] && typeof addressData[field] === 'string' && addressData[field].trim() !== '');
};

const prepareOrderAddress = async (req, addressType, shippingAddressId, newAddressData) => {
  let orderAddress = null;

  if (addressType === 'new' && newAddressData) {
    if (!validateAddressData(newAddressData)) {
      throw new Error('Invalid new address data provided');
    }
    const newShippingAddress = await ShippingAddress.create({
      userId: req.user.id,
      name: newAddressData.name,
      phone: newAddressData.phone,
      address: newAddressData.address,
      city: newAddressData.city,
      state: newAddressData.state,
      country: newAddressData.country,
      pincode: newAddressData.pincode,
      addressType: newAddressData.addressType || 'Home',
      isDefault: newAddressData.isDefault || false
    });
    orderAddress = {
      type: 'new',
      shippingAddressId: newShippingAddress.id,
      addressData: {
        name: newShippingAddress.name,
        phone: newShippingAddress.phone,
        address: newShippingAddress.address,
        city: newShippingAddress.city,
        state: newShippingAddress.state,
        country: newShippingAddress.country,
        pincode: newShippingAddress.pincode,
        addressType: newShippingAddress.addressType,
        isDefault: newShippingAddress.isDefault
      }
    };
  } else if ((addressType === 'shipping' || shippingAddressId) && shippingAddressId) {
    const shippingAddress = await ShippingAddress.findOne({
      where: { id: shippingAddressId, userId: req.user.id }
    });
    if (!shippingAddress) throw new Error('Invalid shipping address selected');
    orderAddress = {
      type: 'shipping',
      shippingAddressId: shippingAddress.id,
      addressData: {
        name: shippingAddress.name,
        phone: shippingAddress.phone,
        address: shippingAddress.address,
        city: shippingAddress.city,
        state: shippingAddress.state,
        country: shippingAddress.country,
        pincode: shippingAddress.pincode,
        addressType: shippingAddress.addressType,
        isDefault: shippingAddress.isDefault
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
      const defaultShipping = await ShippingAddress.findOne({
        where: { userId: req.user.id, isDefault: true }
      });
      const anyShipping = defaultShipping || await ShippingAddress.findOne({
        where: { userId: req.user.id },
        order: [['createdAt', 'DESC']]
      });
      if (!anyShipping) {
        if (hasUsableProfileAddress) {
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
          shippingAddressId: anyShipping.id,
          addressData: {
            name: anyShipping.name,
            phone: anyShipping.phone,
            address: anyShipping.address,
            city: anyShipping.city,
            state: anyShipping.state,
            country: anyShipping.country,
            pincode: anyShipping.pincode,
            addressType: anyShipping.addressType,
            isDefault: !!anyShipping.isDefault,
            source: 'shipping_address_fallback'
          }
        };
      }
    }
  }
  return orderAddress;
};

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
      items,
      shippingAddressId,
      addressType = 'default',
      newAddressData,
      notes,
      expectedDeliveryDate 
    } = req.body;

    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    if (!['Gateway', 'UPI', 'BankTransfer', 'COD'].includes(normalizedPaymentMethod)) {
      return res.status(400).json({ 
        success: false,
        message: 'Valid payment method is required (Gateway, UPI, BankTransfer, COD)' 
      });
    }

    if (['UPI', 'BankTransfer'].includes(normalizedPaymentMethod) && !paymentProof) {
      return res.status(400).json({ 
        success: false,
        message: 'Payment proof is required for UPI and Bank Transfer' 
      });
    }

    if (!['default', 'shipping', 'new'].includes(addressType)) {
      return res.status(400).json({
        success: false,
        message: 'Address type must be "default", "shipping", or "new"'
      });
    }

    let orderAddress;
    try {
      orderAddress = await prepareOrderAddress(req, addressType, shippingAddressId, newAddressData);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.log('📦 Order address prepared:', {
      type: orderAddress.type,
      shippingAddressId: orderAddress.shippingAddressId,
      addressPreview: {
        name: orderAddress.addressData.name,
        city: orderAddress.addressData.city,
        state: orderAddress.addressData.state
      }
    });

    let orderItems = [];
    if (items && items.length > 0) {
      orderItems = items;
    } else {
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

    let subtotal = 0;
    let totalGstAmount = 0;
    const processedOrderItems = [];

    for (const item of orderItems) {
      const product = await Product.findByPk(item.productId, {
        include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'parentId'], required: false }]
      });
      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }
      if (!product.isActive) {
        throw new Error(`Product "${product.name}" is not available`);
      }
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
          category: product.Category ? product.Category.name : null
        }
      });
    }

    const platformCommission = subtotal * 0.02;
    const finalTotal = subtotal + totalGstAmount + platformCommission;

    console.log('📦 Order calculations:', {
      subtotal: subtotal.toFixed(2),
      totalGstAmount: totalGstAmount.toFixed(2),
      platformCommission: platformCommission.toFixed(2),
      finalTotal: finalTotal.toFixed(2)
    });

    const order = await Order.create({
      userId: req.user.id,
      paymentMethod: normalizedPaymentMethod,
      paymentProof: normalizedPaymentMethod === 'COD' ? null : paymentProof,
      total: parseFloat(finalTotal.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      gstAmount: parseFloat(totalGstAmount.toFixed(2)),
      platformCommission: parseFloat(platformCommission.toFixed(2)),
      paymentStatus: normalizedPaymentMethod === 'COD' ? 'Awaiting' : (normalizedPaymentMethod === 'Gateway' ? 'Approved' : 'Awaiting'),
      status: 'Pending',
      shippingAddressId: orderAddress.shippingAddressId,
      deliveryAddressType: orderAddress.type,
      deliveryAddressData: JSON.stringify(orderAddress.addressData),
      notes: notes || null,
      expectedDeliveryDate: expectedDeliveryDate || null,
      orderDate: new Date()
    }, { transaction });

    console.log('📦 Order created with ID:', order.id);

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

    if (!items || items.length === 0) {
      await Cart.destroy({ where: { userId: req.user.id }, transaction });
      console.log('📦 Cart cleared after order creation');
    }

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
        orderDate: order.orderDate,
        deliveryAddress: orderAddress.addressData
      }, { timeout: 5000 });
      console.log('📦 Order sent to CRM successfully');
    } catch (crmError) {
      console.error('❌ CRM integration failed:', crmError.message);
    }

    await transaction.commit();
    console.log('✅ Order creation completed successfully');

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
        expectedDeliveryDate: order.expectedDeliveryDate,
        deliveryAddress: {
          type: orderAddress.type,
          data: orderAddress.addressData
        }
      },
      redirectToPayment: normalizedPaymentMethod === 'Gateway'
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

    const where = { userId: req.user.id };
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
          as: 'OrderItems',
          include: [{
            model: Product,
            as: 'Product',
            include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'parentId'], required: false }]
          }]
        },
        { model: ShippingAddress, as: 'ShippingAddress', required: false },
        { model: User, as: 'User', attributes: ['id', 'name', 'email', 'role', 'mobile', 'address', 'city', 'state', 'country', 'pincode'], required: false }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: Number(limit),
      offset: Number(offset)
    });

    console.log('📋 Found orders:', orders.length);

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
        if (orderData.ShippingAddress) {
          deliveryAddress = {
            type: 'shipping',
            data: {
              name: orderData.ShippingAddress.name,
              phone: orderData.ShippingAddress.phone,
              address: orderData.ShippingAddress.address,
              city: orderData.ShippingAddress.city,
              state: orderData.ShippingAddress.state,
              country: orderData.ShippingAddress.country,
              pincode: orderData.ShippingAddress.pincode,
              addressType: orderData.ShippingAddress.addressType
            }
          };
        } else if (orderData.User) {
          deliveryAddress = {
            type: 'default',
            data: {
              name: orderData.User.name,
              phone: orderData.User.mobile || 'Not provided',
              address: orderData.User.address,
              city: orderData.User.city,
              state: orderData.User.state,
              country: orderData.User.country,
              pincode: orderData.User.pincode,
              source: 'user_profile'
            }
          };
        }
      }
      orderData.deliveryAddress = deliveryAddress;
      if (orderData.OrderItems) {
        orderData.OrderItems = orderData.OrderItems.map(item => {
          const itemData = { ...item };
          if (item.Product) {
            const processedProduct = processProductData(item.Product, req);
            itemData.Product = {
              ...processedProduct,
              currentPrice: computePrice(item.Product, req.user.role),
              orderPrice: parseFloat(item.price)
            };
          }
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

    const orderSummary = {
      totalOrders: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      ordersPerPage: Number(limit),
      statusBreakdown: {},
      paymentStatusBreakdown: {}
    };

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
      filters: { status, paymentStatus, startDate, endDate },
      pagination: { page: Number(page), limit: Number(limit), total: count, totalPages: Math.ceil(count / limit) },
      sorting: { sortBy, sortOrder }
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

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📋 GET ORDER BY ID - Order ID:', id, 'User ID:', req.user?.id);

    const order = await Order.findOne({
      where: { 
        id: id,
        ...(req.user.role === 'Admin' || req.user.role === 'Manager' ? {} : { userId: req.user.id })
      },
      include: [
        {
          model: OrderItem,
          as: 'OrderItems',
          include: [{
            model: Product,
            as: 'Product',
            include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'parentId'], required: false }]
          }]
        },
        { model: ShippingAddress, as: 'ShippingAddress', required: false },
        { model: User, as: 'User', attributes: ['id', 'name', 'email', 'role', 'mobile', 'company', 'address', 'city', 'state', 'country', 'pincode'], required: false }
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
        console.warn('Failed to parse delivery address data:', e);
      }
    }
    if (!deliveryAddress) {
      if (orderData.ShippingAddress) {
        deliveryAddress = {
          type: 'shipping',
          data: {
            name: orderData.ShippingAddress.name,
            phone: orderData.ShippingAddress.phone,
            address: orderData.ShippingAddress.address,
            city: orderData.ShippingAddress.city,
            state: orderData.ShippingAddress.state,
            country: orderData.ShippingAddress.country,
            pincode: orderData.ShippingAddress.pincode,
            addressType: orderData.ShippingAddress.addressType
          }
        };
      } else if (orderData.User) {
        deliveryAddress = {
          type: 'default',
          data: {
            name: orderData.User.name,
            phone: orderData.User.mobile || 'Not provided',
            address: orderData.User.address,
            city: orderData.User.city,
            state: orderData.User.state,
            country: orderData.User.country,
            pincode: orderData.User.pincode,
            source: 'user_profile'
          }
        };
      }
    }
    orderData.deliveryAddress = deliveryAddress;
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
    res.json({ success: true, order: orderData });
  } catch (error) {
    console.error('❌ GET ORDER BY ID ERROR:', error);
    res.status(400).json({ 
      success: false,
      message: error.message || 'Failed to fetch order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus, paymentProof, notes, expectedDeliveryDate, trackingNumber, shippingProvider } = req.body;
    
    console.log('🔄 UPDATE ORDER - Order ID:', id, 'User Role:', req.user?.role);
    console.log('   Update data:', { status, paymentStatus, notes });

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
      if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
      if (shippingProvider !== undefined) updateData.shippingProvider = shippingProvider;
    } else {
      if (order.status === 'Pending' && paymentProof !== undefined && order.paymentMethod !== 'COD') {
        updateData.paymentProof = paymentProof;
      }
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
        return res.status(400).json({ success: false, message: `Cannot change order status from ${order.status} to ${status}` });
      }
    }

    await order.update(updateData);
    console.log('✅ Order updated successfully');

    try {
      await axios.put(`https://crm-api.example.com/orders/${id}`, {
        orderId: id,
        ...updateData,
        updatedBy: req.user.id,
        updatedByRole: req.user.role,
        updatedAt: new Date()
      }, { timeout: 5000 });
      console.log('📦 Order update sent to CRM successfully');
    } catch (crmError) {
      console.error('❌ CRM update failed:', crmError.message);
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

const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    console.log('❌ CANCEL ORDER - Order ID:', id, 'User ID:', req.user?.id);

    const order = await Order.findOne({
      where: { id: id, userId: req.user.id }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!['Pending', 'Processing'].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel order with status: ${order.status}` });
    }

    await order.update({ 
      status: 'Cancelled',
      cancellationReason: reason || 'Cancelled by user',
      cancelledAt: new Date()
    });

    console.log('✅ Order cancelled successfully');

    try {
      await axios.put(`https://crm-api.example.com/orders/${id}/cancel`, {
        orderId: id,
        reason: reason || 'Cancelled by user',
        cancelledBy: req.user.id,
        cancelledAt: new Date()
      }, { timeout: 5000 });
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

const deleteOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    
    console.log('🗑️ DELETE ORDER - Order ID:', id, 'Admin:', req.user?.role);

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    await OrderItem.destroy({ where: { orderId: id }, transaction });
    await order.destroy({ transaction });

    await transaction.commit();
    console.log('✅ Order deleted successfully');

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
      include: [{ model: User, as: 'User', attributes: ['name', 'email'] }]
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

const getAvailableAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'mobile', 'address', 'city', 'state', 'country', 'pincode']
    });
    const shippingAddresses = await ShippingAddress.findAll({
      where: { userId },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
    });
    
    const availableAddresses = {
      defaultAddress: null,
      shippingAddresses: shippingAddresses || []
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
        totalShippingAddresses: shippingAddresses.length,
        defaultShippingAddress: shippingAddresses.find(addr => addr.isDefault) || null
      }
    });
  } catch (error) {
    console.error('❌ GET AVAILABLE ADDRESSES ERROR:', error);
    res.status(400).json({ 
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
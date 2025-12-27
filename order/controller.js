const { Order, OrderItem, Product, Category, ShippingAddress, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { processOrderProductData, calculateUserPrice, getFallbackImageUrl } = require('../utils/imageUtils');
const OrderService = require('./service');

// CREATE ORDER
const createOrder = async (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

  try {
    const { order, processedOrderItems, orderAddress, normalizedPaymentMethod } = await OrderService.createOrder(req, req.body);

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
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

  const userRole = req.user.role;
  if (userRole === 'Support') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    const currentUserId = req.user.id;
    const { status, paymentStatus, customer, startDate, endDate, page = 1, limit = 10, sortBy = 'orderDate', sortOrder = 'DESC', userId, orderId } = req.query;
    const isStaff = ['SuperAdmin', 'Admin', 'Sales'].includes(userRole);

    if (!isStaff) {
      if (customer) return res.status(400).json({ success: false, message: 'Search by customer not allowed' });
      if (userId && parseInt(userId) !== currentUserId) return res.status(403).json({ success: false, message: 'Restricted access' });
    }

    let targetUserId = (!isStaff) ? currentUserId : (userId ? parseInt(userId) : null);

    // Build query
    const where = {};
    if (targetUserId) where.userId = targetUserId;
    if (orderId) where.id = orderId; // Add filter for orderId
    if (status) where.status = Array.isArray(status) ? { [Op.in]: status } : status;
    if (paymentStatus) where.paymentStatus = Array.isArray(paymentStatus) ? { [Op.in]: paymentStatus } : paymentStatus;
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
          model: OrderItem, as: 'orderItems',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'description', 'image', 'images', 'generalPrice', 'dealerPrice', 'architectPrice', 'isActive', 'colors', 'specifications'], include: [{ model: Category, as: 'category' }] }]
        },
        { model: ShippingAddress, as: 'shippingAddress' },
        userInclude
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: Number(limit),
      offset: Number(offset)
    });

    const processedOrders = orders.map(order => {
      const orderData = order.toJSON();

      const deliveryAddress = orderData.deliveryAddressData ?
        (typeof orderData.deliveryAddressData === 'string' ? JSON.parse(orderData.deliveryAddressData) : orderData.deliveryAddressData) : null;

      orderData.deliveryAddress = { type: orderData.deliveryAddressType, data: deliveryAddress };

      if (orderData.orderItems) {
        orderData.orderItems = orderData.orderItems.map(item => {
          if (item.product) {
            item.product = processOrderProductData(item.product, req, userRole);
          }
          return item;
        });
      }
      return orderData;
    });

    // Stats
    // Use the same 'where' clause for stats to reflect current filters
    const whereForStats = { ...where };
    const orderSummary = await OrderService.getOrderSummary(count, limit, page, whereForStats);

    res.json({
      success: true,
      orders: processedOrders,
      orderSummary,
      forUser: targetUserId ? { id: targetUserId, isFiltered: true } : { id: null, isFiltered: false, reason: 'Staff Code' },
      isStaffView: isStaff && !targetUserId,
      pagination: { page: Number(page), limit: Number(limit), total: count, totalPages: Math.ceil(count / limit) }
    });

  } catch (error) {
    createOrder.error('GET ORDERS ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOrderById = async (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  if (req.user.role === 'Support') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const isStaff = ['SuperAdmin', 'Admin', 'Sales'].includes(req.user.role);

    const where = { id };
    if (!isStaff) where.userId = currentUserId;

    const order = await Order.findOne({
      where,
      include: [
        {
          model: OrderItem, as: 'orderItems',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'description', 'image', 'images', 'generalPrice', 'dealerPrice', 'architectPrice', 'isActive', 'colors', 'specifications'], include: [{ model: Category, as: 'category' }] }]
        },
        { model: ShippingAddress, as: 'shippingAddress' },
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'mobile', 'address', 'city', 'state', 'country', 'pincode'] }
      ]
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const orderData = order.toJSON();
    const deliveryAddress = orderData.deliveryAddressData ?
      (typeof orderData.deliveryAddressData === 'string' ? JSON.parse(orderData.deliveryAddressData) : orderData.deliveryAddressData) : null;
    orderData.deliveryAddress = { type: orderData.deliveryAddressType, data: deliveryAddress };

    if (orderData.orderItems) {
      orderData.orderItems = orderData.orderItems.map(item => {
        if (item.product) {
          item.product = processOrderProductData(item.product, req, req.user.role);
        }
        return item;
      });
    }

    res.json({ success: true, order: orderData });
  } catch (error) {
    console.error('GET ORDER BY ID ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateOrder = async (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  const isStaff = ['SuperAdmin', 'Admin', 'Manager', 'Sales'].includes(req.user.role);
  if (!isStaff) return res.status(403).json({ success: false, message: 'Unauthorized' });

  try {
    const { id } = req.params;
    const { status, paymentStatus, notes } = req.body;

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const updates = {};
    if (status) updates.status = status;
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    if (notes) updates.notes = notes;
    if (req.body.expectedDeliveryDate) updates.expectedDeliveryDate = req.body.expectedDeliveryDate;

    await order.update(updates);
    res.json({ success: true, message: 'Order updated successfully', order });
  } catch (error) {
    console.error('UPDATE ORDER ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const cancelOrder = async (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const isStaff = ['SuperAdmin', 'Admin', 'Manager'].includes(req.user.role);

    const where = { id };
    if (!isStaff) where.userId = currentUserId;

    const order = await Order.findOne({ where });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.status !== 'Pending' && !isStaff) {
      return res.status(400).json({ success: false, message: 'Cannot cancel order that is not pending' });
    }

    await order.update({ status: 'Cancelled' });
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('CANCEL ORDER ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteOrder = async (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  if (!['SuperAdmin', 'Admin'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Unauthorized' });

  try {
    await Order.destroy({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('DELETE ORDER ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOrderStats = async (req, res) => {
  // Basic stats implementation
  try {
    const stats = await OrderService.getOrderSummary(0, 0, 0, {}); // Helper usage or generic
    res.json({ success: true, stats });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getAvailableAddresses = async (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Auth required' });
  try {
    const addresses = await ShippingAddress.findAll({ where: { userId: req.user.id } });
    res.json({ success: true, addresses });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
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
// order/controller.js
const { Order, OrderItem, Product, Cart, sequelize } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');

const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { paymentMethod, paymentProof, items } = req.body;
    
    let total = 0;
    const orderItems = [];
    
    for (const item of items) {
      const product = await Product.findByPk(item.productId);
      if (!product) throw new Error('Product not found');
      
      const price = req.user.role === 'Dealer' ? product.dealerPrice :
                   req.user.role === 'Architect' ? product.architectPrice :
                   product.generalPrice;
      
      total += price * item.quantity;
      orderItems.push({ productId: item.productId, quantity: item.quantity, price });
    }
    
    total *= 1.02; // Add 2% platform commission
    
    const order = await Order.create({
      userId: req.user.id,
      paymentMethod,
      paymentProof,
      total,
      paymentStatus: paymentMethod === 'Gateway' ? 'Approved' : 'Awaiting'
    }, { transaction });
    
    await OrderItem.bulkCreate(orderItems.map(item => ({
      ...item,
      orderId: order.id
    })), { transaction });
    
    await Cart.destroy({ where: { userId: req.user.id }, transaction });
    
    // Send to CRM
    try {
      await axios.post('https://crm-api.example.com/orders', {
        orderId: order.id,
        userId: req.user.id,
        total,
        status: order.status
      });
    } catch (crmError) {
      console.error('CRM integration failed:', crmError.message);
    }
    
    await transaction.commit();
    res.status(201).json(order);
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    const where = { userId: req.user.id };
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = startDate;
      if (endDate) where.createdAt[Op.lte] = endDate;
    }
    
    const orders = await Order.findAll({
      where,
      include: [{ model: OrderItem, include: [Product] }]
    });
    res.json(orders);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus, paymentProof } = req.body;
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    await order.update({ status, paymentStatus, paymentProof });
    
    // Update CRM
    try {
      await axios.put(`https://crm-api.example.com/orders/${id}`, {
        status,
        paymentStatus
      });
    } catch (crmError) {
      console.error('CRM update failed:', crmError.message);
    }
    
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { createOrder, getOrders, updateOrder };
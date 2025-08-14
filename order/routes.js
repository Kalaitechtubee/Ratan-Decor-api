// order/routes.js
const express = require('express');
const router = express.Router();
const { 
  createOrder, 
  getOrders, 
  getOrderById, 
  updateOrder, 
  cancelOrder, 
  deleteOrder,
  getOrderStats 
} = require('./controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Public/User routes
router.post('/', authMiddleware, createOrder);                    // Create new order
router.get('/', authMiddleware, getOrders);                       // Get user's orders with filters
router.get('/stats', authMiddleware, getOrderStats);              // Get order statistics
router.get('/:id', authMiddleware, getOrderById);                 // Get specific order details
router.put('/:id/cancel', authMiddleware, cancelOrder);           // Cancel order (user)

// Admin/Manager routes
router.put('/:id', authMiddleware, requireRole(['Admin', 'Manager']), updateOrder);     // Update order (admin)
router.delete('/:id', authMiddleware, requireRole(['Admin']), deleteOrder);             // Delete order (admin only)

module.exports = router;
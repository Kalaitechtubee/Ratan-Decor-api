const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
  deleteOrder,
  getOrderStats,
  getAvailableAddresses
} = require('./controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/addresses', authMiddleware, getAvailableAddresses);
router.post('/', authMiddleware, createOrder);
router.get('/', authMiddleware, getOrders);
router.get('/stats', authMiddleware, getOrderStats);
router.get('/:id', authMiddleware, getOrderById);
router.put('/:id/cancel', authMiddleware, cancelOrder);
router.put('/:id', authMiddleware, requireRole(['Admin', 'Manager']), updateOrder);
router.delete('/:id', authMiddleware, requireRole(['Admin']), deleteOrder);

module.exports = router;
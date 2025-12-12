const express = require('express');
const router = express.Router();
const {
  createOrder, getOrders, getOrderById, updateOrder,
  cancelOrder, deleteOrder, getOrderStats, getAvailableAddresses
} = require('./controller');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.general);

router.get('/addresses', auditLogger, getAvailableAddresses);
router.post('/', auditLogger, createOrder);
router.get('/', auditLogger, getOrders);
router.get('/stats', auditLogger, getOrderStats);
router.get('/:id', auditLogger, getOrderById);
router.put('/:id/cancel', auditLogger, cancelOrder);
router.put('/:id', auditLogger, updateOrder);
router.delete('/:id', auditLogger, deleteOrder);

router.use((error, req, res, next) => {
  console.error('Order route error:', error);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = router;
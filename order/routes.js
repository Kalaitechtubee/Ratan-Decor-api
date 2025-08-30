// routes/order.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
  deleteOrder,
  getOrderStats,
  getAvailableAddresses
} = require('./controller'); // Adjusted path if needed
const { authMiddleware, requireRole } = require('../middleware');

// Debug route
router.post('/debug-token', (req, res) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.json({ error: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    res.json({
      decoded,
      tokenFields: Object.keys(decoded),
      hasId: !!decoded.id,
      hasUserId: !!decoded.userId,
      hasSub: !!decoded.sub,
      idValue: decoded.id,
      userIdValue: decoded.userId,
      subValue: decoded.sub
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// Routes
router.get('/addresses', authMiddleware, getAvailableAddresses);
router.post('/', authMiddleware, createOrder);
router.get('/', authMiddleware, getOrders);
router.get('/stats', authMiddleware, getOrderStats);
router.get('/:id', authMiddleware, getOrderById);
router.put('/:id/cancel', authMiddleware, cancelOrder);
router.put('/:id', authMiddleware, requireRole(['Admin', 'Manager']), updateOrder);
router.delete('/:id', authMiddleware, requireRole(['Admin']), deleteOrder);

module.exports = router;
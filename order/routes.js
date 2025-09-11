// routes/orders.js
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
} = require('./controller');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Debug token endpoint (development only)
router.post('/debug-token', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.decode(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    const verified = jwt.verify(token, process.env.JWT_SECRET);

    res.json({
      success: true,
      message: 'Token is valid',
      decoded: {
        id: verified.id,
        email: verified.email,
        role: verified.role,
        name: verified.name,
        iat: verified.iat,
        exp: verified.exp,
        isExpired: Date.now() >= verified.exp * 1000
      },
      tokenInfo: {
        isValid: true,
        expiresAt: new Date(verified.exp * 1000),
        issuedAt: new Date(verified.iat * 1000)
      }
    });
  } catch (error) {
    console.error('Debug token error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Token verification failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get available addresses for order creation
router.get('/addresses', getAvailableAddresses);

// Create new order
router.post('/', createOrder);

// Get orders with role-based filtering
router.get('/', (req, res, next) => {
  // If user is not admin/manager, filter by their userId
  if (!['Admin', 'Manager', 'Sales'].includes(req.user.role)) {
    req.query.userId = req.user.id;
  }
  next();
}, getOrders);

// Get order statistics (admin/manager only)
router.get('/stats', moduleAccess.requireSalesAccess, getOrderStats);

// Get specific order by ID (with ownership check)
router.get('/:id', requireOwnDataOrStaff, getOrderById);

// Cancel order (user can cancel their own orders)
router.put('/:id/cancel', requireOwnDataOrStaff, cancelOrder);

// Update order (admin/manager only)
router.put('/:id', moduleAccess.requireSalesAccess, updateOrder);

// Delete order (admin only)
router.delete('/:id', moduleAccess.requireAdmin, deleteOrder);

module.exports = router;
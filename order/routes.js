// routes/orders.js - Order Management (Sales focused)
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

// All routes require authentication
router.use(authenticateToken);

// Debug token endpoint - for debugging JWT tokens
router.post('/debug-token', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Decode token without verification for debugging
    const decoded = jwt.decode(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    // Verify token
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

// User addresses (own data only)
router.get('/addresses', getAvailableAddresses);

// Create order (any user can create)
router.post('/', createOrder);

// Get orders (users see own, staff see all)
router.get('/', (req, res, next) => {
  // If not staff, filter to own orders only
  if (!['Admin', 'Manager', 'Sales'].includes(req.user.role)) {
    req.query.userId = req.user.id;
  }
  next();
}, getOrders);

// Order statistics (Admin, Manager, Sales only)
router.get('/stats',
  moduleAccess.requireSalesAccess,
  getOrderStats
);

// Get specific order (own data or staff)
router.get('/:id',
  requireOwnDataOrStaff,
  getOrderById
);

// Cancel order (own data or staff)
router.put('/:id/cancel',
  requireOwnDataOrStaff,
  cancelOrder
);

// Update order (Admin, Manager, Sales only)
router.put('/:id',
  moduleAccess.requireSalesAccess,
  updateOrder
);

// Delete order (Admin only)
router.delete('/:id',
  moduleAccess.requireAdmin,
  deleteOrder
);

module.exports = router;
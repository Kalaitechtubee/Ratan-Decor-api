// routes/order.js - Updated without express-validator
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
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.general);

// Debug token endpoint (Admin/SuperAdmin only for security)
router.post('/debug-token',
  moduleAccess.requireAdmin, // Restrict to SuperAdmin/Admin
  auditLogger,
  (req, res) => {
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
  }
);

// Get available addresses (public but auth-protected)
router.get('/addresses',
  auditLogger,
  getAvailableAddresses
);

// Create order (authenticated user)
router.post('/',
  auditLogger,
  createOrder
);

// Get orders - Staff (SuperAdmin/Admin/Manager/Sales/Support) can see all, others only their own
router.get('/', auditLogger, (req, res, next) => {
  // Check if user has staff access
  const staffRoles = ['SuperAdmin', 'Admin', 'Manager', 'Sales', 'Support'];
  if (!staffRoles.includes(req.user.role)) {
    // Non-staff users can only see their own orders
    req.query.userId = req.user.id;
  }
  next();
}, getOrders);

// Order stats (Sales/Staff access - SuperAdmin/Admin included)
router.get('/stats',
  moduleAccess.requireSalesAccess,
  auditLogger,
  getOrderStats
);

// Get order by ID (own or staff - SuperAdmin/Admin bypass via staff)
router.get('/:id',
  requireOwnDataOrStaff, // Ensures ownership or staff access
  auditLogger,
  getOrderById
);

// Cancel order (own or staff)
router.put('/:id/cancel',
  requireOwnDataOrStaff,
  auditLogger,
  cancelOrder
);

// Update order (Sales/Staff - SuperAdmin/Admin included)
router.put('/:id',
  moduleAccess.requireSalesAccess,
  auditLogger,
  updateOrder
);

// Delete order (Admin/SuperAdmin)
router.delete('/:id',
  moduleAccess.requireAdmin,
  auditLogger,
  deleteOrder
);

module.exports = router;
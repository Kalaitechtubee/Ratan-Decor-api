
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


router.use(authenticateToken);

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


router.get('/addresses', getAvailableAddresses);


router.post('/', createOrder);


router.get('/', (req, res, next) => {

  if (!['admin', 'manager', 'sales', 'User'].includes(req.user.role)) {
    req.query.userId = req.user.id;
  }
  next();
}, getOrders);

router.get('/stats', moduleAccess.requireSalesAccess, getOrderStats);


router.get('/:id', getOrderById);


router.put('/:id/cancel', cancelOrder);

router.put('/:id', moduleAccess.requireSalesAccess, updateOrder);


router.delete('/:id', moduleAccess.requireAdmin, deleteOrder);

module.exports = router;
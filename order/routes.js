// order/routes.js
const express = require('express');
const router = express.Router();
const { createOrder, getOrders, updateOrder } = require('./controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.post('/', authMiddleware, createOrder);
router.get('/', authMiddleware, getOrders);
router.put('/:id', authMiddleware, requireRole(['Admin', 'Manager']), updateOrder);

module.exports = router;
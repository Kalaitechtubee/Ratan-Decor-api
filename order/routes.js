// order/routes.js
const express = require('express');
const router = express.Router();
const { createOrder, getOrders, updateOrder } = require('./controller');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, createOrder);
router.get('/', authenticate, getOrders);
router.put('/:id', authenticate, authorize(['Admin', 'Manager']), updateOrder);

module.exports = router;
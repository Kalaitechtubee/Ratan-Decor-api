const express = require('express');
const router = express.Router();
const userTypeController = require('./controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Public routes - Get user types
router.get('/', userTypeController.getAllUserTypes);
router.get('/:id', userTypeController.getUserTypeById);

// Protected routes - User type management (Admin/Manager only)
router.post('/', authMiddleware, requireRole(['Admin', 'Manager']), userTypeController.createUserType);
router.put('/:id', authMiddleware, requireRole(['Admin', 'Manager']), userTypeController.updateUserType);
router.delete('/:id', authMiddleware, requireRole(['Admin']), userTypeController.deleteUserType);

module.exports = router;
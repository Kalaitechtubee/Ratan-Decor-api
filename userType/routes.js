const express = require('express');
const router = express.Router();
const userTypeController = require('./controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Public routes
router.get('/all', userTypeController.getAllUserTypes);
router.get('/:id', userTypeController.getUserTypeById);

// Protected routes (Admin/Manager only)
router.post('/create', authMiddleware, requireRole(['Admin', 'Manager']), userTypeController.createUserType);
router.put('/:id', authMiddleware, requireRole(['Admin', 'Manager']), userTypeController.updateUserType);
router.delete('/:id', authMiddleware, requireRole(['Admin']), userTypeController.deleteUserType);
router.get('/stats/overview', authMiddleware, requireRole(['Admin', 'Manager']), userTypeController.getUserTypeStats);

// Set user type for specific user
router.post('/set-type', authMiddleware, requireRole(['Admin', 'Manager']), userTypeController.setUserTypeForUser);

module.exports = router;

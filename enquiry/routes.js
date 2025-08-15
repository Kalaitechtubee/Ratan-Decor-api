const express = require('express');
const router = express.Router();
const enquiryController = require('./controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Public routes
router.post('/create', enquiryController.createEnquiry);

// Protected routes (Admin/Manager/Sales/Support)
router.get('/all', authenticateToken, authorizeRoles(['Admin', 'Manager', 'Sales', 'Support']), enquiryController.getAllEnquiries);
router.put('/:id/status', authenticateToken, authorizeRoles(['Admin', 'Manager', 'Sales']), enquiryController.updateEnquiryStatus);

module.exports = router;

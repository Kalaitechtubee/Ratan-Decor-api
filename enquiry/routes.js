const express = require('express');
const router = express.Router();
const enquiryController = require('../enquiry/controller');
const { authMiddleware: authenticateToken, requireRole: authorizeRoles } = require('../middleware');

router.use(authenticateToken);

router.post('/create', authorizeRoles(['Admin', 'Manager', 'Sales', 'Support']), enquiryController.createEnquiry);
router.get('/all', authorizeRoles(['Admin', 'Manager', 'Sales', 'Support']), enquiryController.getAllEnquiries);
router.get('/:id', authorizeRoles(['Admin', 'Manager', 'Sales', 'Support']), enquiryController.getEnquiryById);
router.put('/:id', authorizeRoles(['Admin', 'Manager', 'Sales', 'Support']), enquiryController.updateEnquiry);
router.put('/:id/status', authorizeRoles(['Admin', 'Manager', 'Sales', 'Support']), enquiryController.updateEnquiryStatus);

module.exports = router;
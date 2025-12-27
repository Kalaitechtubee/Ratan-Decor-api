const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { uploadCatalogFile, handleUploadError } = require('../middleware/upload');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth'); // Assuming you want to key it protected

// Public route to get catalog
router.get('/', controller.getCatalog);

// Protected routes (Admin only)
router.post(
    '/',
    // requireAuth,       // Add these back if you want auth protection
    // requireSuperAdmin, // Add these back if you want auth protection
    uploadCatalogFile,
    handleUploadError,
    controller.uploadCatalog
);

router.delete(
    '/',
    // requireAuth,
    // requireSuperAdmin,
    controller.deleteCatalog
);

module.exports = router;

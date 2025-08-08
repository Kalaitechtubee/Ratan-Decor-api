const express = require('express');
const router = express.Router();
const { getAllCategories, getSubCategories, createDefaultCategories } = require('./controller');

router.get('/', getAllCategories);
router.get('/subcategories/:parentId', getSubCategories);
router.post('/initialize', createDefaultCategories); // Optional: manual initialization endpoint

module.exports = router;

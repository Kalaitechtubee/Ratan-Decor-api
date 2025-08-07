const express = require('express');
const router = express.Router();
const { getAllCategories } = require('./controller');

router.get('/', getAllCategories);

module.exports = router;

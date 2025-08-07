// const express = require('express');
// const router = express.Router();
// const { createProduct, getProducts, updateProduct, deleteProduct } = require('./productController');
// const { authenticate, authorize } = require('../middleware/auth');

// router.post('/', authenticate, authorize(['Admin', 'Manager']), createProduct);
// router.get('/', getProducts);
// router.put('/:id', authenticate, authorize(['Admin', 'Manager']), updateProduct);
// router.delete('/:id', authenticate, authorize(['Admin', 'Manager']), deleteProduct);

// module.exports = router;
// backend/product/routes.js
const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct
} = require('./productController');

// TEMPORARY: Remove authentication for manual Postman testing
router.post('/', createProduct); // <-- Public route for manual testing
router.get('/', getProducts);

// Keep update and delete protected (optional)
router.put('/:id', updateProduct);  // <-- You can re-add auth here if needed
router.delete('/:id', deleteProduct);

module.exports = router;

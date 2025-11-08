
const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductByName,
  searchProductsByName,
  getProductById,
  updateProduct,
  updateProductAll,
  deleteProduct,
  addProductRating,
  getProductRatings
} = require('./productController');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');
const { uploadFields, handleUploadError } = require('../middleware/upload');

// Public routes (no auth needed)
router.get('/', getProducts);
router.get('/name/:name', getProductByName);
router.get('/search', searchProductsByName);
router.get('/:id', getProductById);
router.get('/:productId/ratings', getProductRatings);


router.post('/',
  uploadFields,           
  handleUploadError,     
  authenticateToken,      
  moduleAccess.requireSupportAccess,  
  createProduct           
);

router.patch('/:id',
  uploadFields,           
  handleUploadError,      
  authenticateToken,     
  moduleAccess.requireSupportAccess, 
  updateProduct          
);

router.put('/:id',
  uploadFields,          
  handleUploadError,     
  authenticateToken,      
  moduleAccess.requireSupportAccess, 
  updateProductAll        
);

router.delete('/:id',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, 
  deleteProduct
);


router.post('/:productId/rate',
  authenticateToken,
  addProductRating
);

module.exports = router;

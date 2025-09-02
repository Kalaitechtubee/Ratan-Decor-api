// utils/imageUtils.js - Centralized Image Processing Utilities
const path = require('path');
const fs = require('fs');

/**
 * Centralized image URL generation function
 * Handles various image filename formats and generates proper URLs
 */
const generateImageUrl = (filename, req, imageType = 'products') => {
  if (!filename) return null;
  
  // If already a full URL, return as-is
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }
  
  // If already starts with /uploads/, return as-is (relative path)
  if (filename.startsWith('/uploads/')) {
    return filename;
  }
  
  // Construct base URL if request is available
  const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
  
  // Handle different image types
  const imagePath = `/uploads/${imageType}/${filename}`;
  return `${baseUrl}${imagePath}`;
};

/**
 * Process single image field
 */
const processSingleImage = (imageField, req, imageType = 'products') => {
  if (!imageField) return null;
  
  if (typeof imageField === 'string') {
    return generateImageUrl(imageField, req, imageType);
  }
  
  return null;
};

/**
 * Process multiple images field
 * Handles both array and JSON string formats
 */
const processMultipleImages = (imagesField, req, imageType = 'products') => {
  if (!imagesField) return [];
  
  let imageArray = [];
  
  if (Array.isArray(imagesField)) {
    imageArray = imagesField;
  } else if (typeof imagesField === 'string') {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(imagesField);
      imageArray = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      // If not JSON, treat as single image
      imageArray = [imagesField];
    }
  } else {
    return [];
  }
  
  // Filter out null/undefined and generate URLs
  return imageArray
    .filter(img => img && typeof img === 'string')
    .map(img => generateImageUrl(img, req, imageType));
};

/**
 * Process JSON field (colors, specifications, etc.)
 */
const processJsonField = (field, defaultValue = null) => {
  if (!field) return defaultValue;
  
  if (typeof field === 'object') {
    return field;
  }
  
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      // If parsing fails, return as array if it looks like a single value
      if (Array.isArray(defaultValue)) {
        return [field];
      }
      return defaultValue;
    }
  }
  
  return defaultValue;
};

/**
 * Enhanced product data processor
 */
const processProductData = (product, req) => {
  const productData = product.toJSON ? product.toJSON() : { ...product };
  
  // Process single primary image
  productData.imageUrl = processSingleImage(productData.image, req);
  
  // Process multiple images
  productData.imageUrls = processMultipleImages(productData.images, req);
  
  // Ensure we have at least one image URL for display
  if (productData.imageUrls.length === 0 && productData.imageUrl) {
    productData.imageUrls = [productData.imageUrl];
  }
  
  // Set primary image for display (first available image)
  if (!productData.imageUrl && productData.imageUrls.length > 0) {
    productData.imageUrl = productData.imageUrls[0];
  }
  
  // Process colors
  productData.colors = processJsonField(productData.colors, []);
  
  // Process specifications
  productData.specifications = processJsonField(productData.specifications, {});
  
  // Process other potential JSON fields
  if (productData.features) {
    productData.features = processJsonField(productData.features, []);
  }
  
  if (productData.dimensions) {
    productData.dimensions = processJsonField(productData.dimensions, {});
  }
  
  return productData;
};

/**
 * Price calculation helper
 */
const calculateUserPrice = (product, userRole) => {
  const prices = {
    dealerPrice: parseFloat(product.dealerPrice || 0),
    architectPrice: parseFloat(product.architectPrice || 0),
    generalPrice: parseFloat(product.generalPrice || 0)
  };
  
  switch (userRole) {
    case 'Dealer':
      return prices.dealerPrice || prices.generalPrice;
    case 'Architect':
      return prices.architectPrice || prices.generalPrice;
    default:
      return prices.generalPrice;
  }
};

/**
 * Create price breakdown object
 */
const createPriceBreakdown = (product, userRole, userPrice = null) => {
  const calculatedPrice = userPrice || calculateUserPrice(product, userRole);
  
  return {
    generalPrice: parseFloat(product.generalPrice || 0),
    architectPrice: parseFloat(product.architectPrice || 0),
    dealerPrice: parseFloat(product.dealerPrice || 0),
    userPrice: calculatedPrice,
    userRole: userRole
  };
};

/**
 * Calculate item totals including GST
 */
const calculateItemTotals = (price, quantity, gstRate = 0) => {
  const subtotal = price * quantity;
  const gstAmount = (subtotal * parseFloat(gstRate)) / 100;
  const totalAmount = subtotal + gstAmount;
  
  return {
    unitPrice: parseFloat(price.toFixed(2)),
    quantity: quantity,
    subtotal: parseFloat(subtotal.toFixed(2)),
    gstRate: parseFloat(gstRate),
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2))
  };
};

/**
 * Validate if image file exists on server
 */
const validateImageExists = (filename, imageType = 'products') => {
  if (!filename) return false;
  
  // Skip validation for external URLs
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return true;
  }
  
  const imagePath = path.join(__dirname, '../Uploads', imageType, filename);
  return fs.existsSync(imagePath);
};

/**
 * Clean up invalid images from array
 */
const cleanImageArray = (imageArray, imageType = 'products') => {
  if (!Array.isArray(imageArray)) return [];
  
  return imageArray.filter(img => {
    if (!img || typeof img !== 'string') return false;
    return validateImageExists(img, imageType);
  });
};

/**
 * Get fallback image URL
 */
const getFallbackImageUrl = (req, imageType = 'products') => {
  const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
  return `${baseUrl}/uploads/defaults/no-image.png`;
};

/**
 * Process uploaded files from multer
 */
const processUploadedFiles = (files) => {
  const result = {
    image: null,
    images: []
  };
  
  if (files) {
    // Single image upload
    if (files.image && files.image.length > 0) {
      result.image = files.image[0].filename;
    }
    
    // Multiple images upload
    if (files.images && files.images.length > 0) {
      result.images = files.images.map(file => file.filename);
    }
  }
  
  return result;
};

module.exports = {
  generateImageUrl,
  processSingleImage,
  processMultipleImages,
  processJsonField,
  processProductData,
  calculateUserPrice,
  createPriceBreakdown,
  calculateItemTotals,
  validateImageExists,
  cleanImageArray,
  getFallbackImageUrl,
  processUploadedFiles
};
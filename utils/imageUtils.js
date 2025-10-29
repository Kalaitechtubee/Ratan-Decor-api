const path = require('path');
const fs = require('fs');

const generateImageUrl = (filename, req, imageType = 'products') => {
  if (!filename || typeof filename !== 'string') return null;

  // ✅ Already a full URL
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }

  // ✅ Already includes /uploads/
  if (filename.startsWith('/uploads/')) {
    return filename;
  }

  // ✅ Use BASE_URL from .env (with or without port)
  // If not defined, fallback to req (auto includes port)
  const envBaseUrl = process.env.BASE_URL?.trim();
  const baseUrl = envBaseUrl || `${req.protocol}://${req.get('host')}`;

  // ✅ Construct the full image path
  const imagePath = `/uploads/${imageType}/${filename}`;

  return `${baseUrl}${imagePath}`;
};







const processSingleImage = (imageField, req, imageType = 'products') => {
  if (!imageField) return null;
  
  if (typeof imageField === 'string') {
    return generateImageUrl(imageField, req, imageType);
  }
  
  return null;
};

const processMultipleImages = (imagesField, req, imageType = 'products') => {
  if (!imagesField) return [];
  
  let imageArray = [];
  
  if (Array.isArray(imagesField)) {
    imageArray = imagesField;
  } else if (typeof imagesField === 'string') {
    try {
      const parsed = JSON.parse(imagesField);
      imageArray = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      imageArray = [imagesField];
    }
  } else {
    return [];
  }
  
  return imageArray
    .filter(img => img && typeof img === 'string')
    .map(img => generateImageUrl(img, req, imageType));
};

const processJsonField = (field, defaultValue = null) => {
  if (!field) return defaultValue;
  
  if (typeof field === 'object') {
    return field;
  }
  
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      if (Array.isArray(defaultValue)) {
        return [field];
      }
      return defaultValue;
    }
  }
  
  return defaultValue;
};

const processProductData = (product, req) => {
  if (!product) return null;
  
  const productData = product.toJSON ? product.toJSON() : { ...product };
  
  productData.imageUrl = processSingleImage(productData.image, req);
  productData.imageUrls = processMultipleImages(productData.images, req);
  
  if (productData.imageUrls.length === 0 && productData.imageUrl) {
    productData.imageUrls = [productData.imageUrl];
  }
  
  if (!productData.imageUrl && productData.imageUrls.length > 0) {
    productData.imageUrl = productData.imageUrls[0];
  }
  
  productData.colors = processJsonField(productData.colors, []);
  productData.specifications = processJsonField(productData.specifications, {});
  productData.features = processJsonField(productData.features, []);
  productData.dimensions = processJsonField(productData.dimensions, {});
  
  return productData;
};

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

const validateImageExists = (filename, imageType = 'products') => {
  if (!filename) return false;
  
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return true;
  }
  
  const imagePath = path.join(__dirname, '../uploads', imageType, filename);
  return fs.existsSync(imagePath);
};

const cleanImageArray = (imageArray, imageType = 'products') => {
  if (!Array.isArray(imageArray)) return [];
  
  return imageArray.filter(img => {
    if (!img || typeof img !== 'string') return false;
    return validateImageExists(img, imageType);
  });
};

const getFallbackImageUrl = (req, imageType = 'products') => {
  const baseUrl = process.env.BASE_URL || 'http://localhost';
  return `${baseUrl}/uploads/defaults/no-image.png`;
};

const processUploadedFiles = (files) => {
  const result = {
    image: null,
    images: []
  };
  
  if (files) {
    if (files.image && files.image.length > 0) {
      result.image = files.image[0].filename;
    }
    
    if (files.images && files.images.length > 0) {
      result.images = files.images.map(file => file.filename);
    }
  }
  
  return result;
};

const processOrderProductData = (product, req, userRole = 'customer') => {
  if (!product) return null;
  
  const processedProduct = processProductData(product, req);
  
  return {
    id: product.id,
    name: product.name,
    description: product.description || null,
    imageUrl: processedProduct.imageUrl || getFallbackImageUrl(req),
    imageUrls: processedProduct.imageUrls || [],
    displayImage: processedProduct.imageUrl || getFallbackImageUrl(req),
    currentPrice: calculateUserPrice(product, userRole),
    generalPrice: parseFloat(product.generalPrice || 0),
    dealerPrice: parseFloat(product.dealerPrice || 0),
    architectPrice: parseFloat(product.architectPrice || 0),
    isActive: product.isActive,
    category: product.category ? {
      id: product.category.id,
      name: product.category.name,
      parentId: product.category.parentId
    } : null,
    colors: processedProduct.colors || [],
    specifications: processedProduct.specifications || [],
    features: processedProduct.features || [],
    dimensions: processedProduct.dimensions || []
  };
};

module.exports = {
  generateImageUrl,
  processSingleImage,
  processMultipleImages,
  processJsonField,
  processProductData,
  processOrderProductData,
  calculateUserPrice,
  createPriceBreakdown,
  calculateItemTotals,
  validateImageExists,
  cleanImageArray,
  getFallbackImageUrl,
  processUploadedFiles
};
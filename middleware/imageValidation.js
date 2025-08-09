const validateImage = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image file is required' });
  }

  // Check file size (5MB limit)
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ message: 'Image file size must be less than 5MB' });
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ 
      message: 'Only JPEG, JPG, PNG, and WebP images are allowed' 
    });
  }

  next();
};

module.exports = { validateImage };




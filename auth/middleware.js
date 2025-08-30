// middleware/index.js - FIXED VERSION
const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    console.log('Decoded token:', decoded); // Debug log
    
    // Ensure req.user has the correct structure
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      status: decoded.status,
      userTypeId: decoded.userTypeId
    };
    
    console.log('req.user set to:', req.user); // Debug log
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = { authMiddleware };

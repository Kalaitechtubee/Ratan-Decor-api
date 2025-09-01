// middleware/security.js - Enhanced Security Measures
const rateLimit = require('express-rate-limit');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Different rate limits for different endpoints
const rateLimits = {
  // Authentication endpoints - stricter limits
  auth: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts
    'Too many authentication attempts. Please try again in 15 minutes.'
  ),
  
  // Registration - prevent spam
  register: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // 3 registrations per hour
    'Too many registration attempts. Please try again in 1 hour.'
  ),
  
  // OTP/Password reset - prevent abuse
  otp: createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    3, // 3 OTP requests
    'Too many OTP requests. Please try again in 5 minutes.'
  ),
  
  // General API - reasonable limits
  general: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests
    'Too many requests. Please try again later.'
  ),
  
  // Admin operations - moderate limits
  admin: createRateLimiter(
    10 * 60 * 1000, // 10 minutes
    50, // 50 requests
    'Too many admin operations. Please try again in 10 minutes.'
  )
};

// IP-based request tracking for suspicious activity
const suspiciousActivityTracker = new Map();

const trackSuspiciousActivity = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!suspiciousActivityTracker.has(ip)) {
    suspiciousActivityTracker.set(ip, {
      failedLogins: 0,
      lastFailedLogin: 0,
      blockedUntil: 0
    });
  }
  
  const tracker = suspiciousActivityTracker.get(ip);
  
  // Check if IP is currently blocked
  if (tracker.blockedUntil > now) {
    return res.status(429).json({
      success: false,
      message: 'IP temporarily blocked due to suspicious activity',
      blockedUntil: new Date(tracker.blockedUntil).toISOString()
    });
  }
  
  // Clean up old entries (older than 1 hour)
  if (now - tracker.lastFailedLogin > 60 * 60 * 1000) {
    tracker.failedLogins = 0;
  }
  
  req.securityTracker = tracker;
  next();
};

// Enhanced login security wrapper
const enhanceLoginSecurity = (loginController) => {
  return async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    const tracker = req.securityTracker;
    
    // Store original res.status and res.json to intercept responses
    const originalStatus = res.status;
    const originalJson = res.json;
    
    let statusCode = 200;
    let responseData = null;
    
    // Override res.status to capture status code
    res.status = function(code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };
    
    // Override res.json to capture response and handle security
    res.json = function(data) {
      responseData = data;
      
      // If login failed, track it
      if (statusCode === 401 || statusCode === 403) {
        tracker.failedLogins++;
        tracker.lastFailedLogin = Date.now();
        
        // Block IP after 5 failed attempts
        if (tracker.failedLogins >= 5) {
          tracker.blockedUntil = Date.now() + (30 * 60 * 1000); // 30 minutes
          console.warn(`IP ${ip} blocked for 30 minutes due to ${tracker.failedLogins} failed login attempts`);
        }
      } else if (statusCode === 200) {
        // Reset on successful login
        tracker.failedLogins = 0;
      }
      
      return originalJson.call(this, responseData);
    };
    
    // Call the original login controller
    return loginController(req, res);
  };
};

// Password policy validation
const validatePasswordPolicy = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potential XSS attempts
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
          .trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };
  
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  
  next();
};

// Request logging for audit trails
const auditLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'anonymous',
      userRole: req.user?.role || 'none',
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0
    };
    
    // Log security-relevant events
    if (req.originalUrl.includes('/login') || 
        req.originalUrl.includes('/register') ||
        req.originalUrl.includes('/admin') ||
        res.statusCode >= 400) {
      console.log('AUDIT:', JSON.stringify(logData));
    }
  });
  
  next();
};

// Session management enhancements
const sessionSecurity = {
  // Token blacklist (in production, use Redis)
  blacklistedTokens: new Set(),
  
  // Add token to blacklist on logout
  blacklistToken: (token) => {
    sessionSecurity.blacklistedTokens.add(token);
    // Clean up old tokens periodically
    if (sessionSecurity.blacklistedTokens.size > 10000) {
      sessionSecurity.blacklistedTokens.clear();
    }
  },
  
  // Check if token is blacklisted
  isTokenBlacklisted: (token) => {
    return sessionSecurity.blacklistedTokens.has(token);
  }
};

// Enhanced logout with token blacklisting
const secureLogout = (req, res) => {
  if (req.token) {
    sessionSecurity.blacklistToken(req.token);
  }
  res.json({ 
    success: true, 
    message: 'Logout successful. Token invalidated.' 
  });
};

module.exports = {
  rateLimits,
  trackSuspiciousActivity,
  enhanceLoginSecurity,
  validatePasswordPolicy,
  sanitizeInput,
  auditLogger,
  sessionSecurity,
  secureLogout
};
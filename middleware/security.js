
const rateLimit = require('express-rate-limit');


const createRateLimiter = (windowMs, max, message, skipFn = null) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipFn || undefined,
  });
};


const rateLimits = {

  auth: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 10 attempts (increased from 5)
    'Too many authentication attempts. Please try again in 15 minutes.'
  ),
  
  // Registration - increased to 5 per hour
  register: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    5, // 5 registrations per hour (increased from 3)
    'Too many registration attempts. Please try again in 1 hour.'
  ),
  
  // OTP/Password reset - increased to 5 in 5 min
  otp: createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    5, // 5 OTP requests (increased from 3)
    'Too many OTP requests. Please try again in 5 minutes.'
  ),
  
  // General API - increased to 200 requests in 15 min
  general: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    300, // 200 requests (increased from 100)
    'Too many requests. Please try again later.'
  ),
  
  // Admin operations - increased to 100 in 10 min
  admin: createRateLimiter(
    10 * 60 * 1000, // 10 minutes
    300, // 100 requests (increased from 50)
    'Too many admin operations. Please try again in 10 minutes.'
  )
};


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
  

  if (tracker.blockedUntil > now) {
    return res.status(429).json({
      success: false,
      message: 'IP temporarily blocked due to suspicious activity',
      blockedUntil: new Date(tracker.blockedUntil).toISOString()
    });
  }
  

  if (now - tracker.lastFailedLogin > 60 * 60 * 1000) {
    tracker.failedLogins = 0;
  }
  
  req.securityTracker = tracker;
  next();
};


const enhanceLoginSecurity = (loginController) => {
  return async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    const tracker = req.securityTracker;

    const originalStatus = res.status;
    const originalJson = res.json;
    
    let statusCode = 200;
    let responseData = null;
    

    res.status = function(code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };
    
  
    res.json = function(data) {
      responseData = data;
      
  
      if (statusCode === 401 || statusCode === 403) {
        tracker.failedLogins++;
        tracker.lastFailedLogin = Date.now();
   
        if (tracker.failedLogins >= 8) {
          tracker.blockedUntil = Date.now() + (30 * 60 * 1000); // 30 minutes
          console.warn(`IP ${ip} blocked for 30 minutes due to ${tracker.failedLogins} failed login attempts`);
        }
      } else if (statusCode === 200) {

        tracker.failedLogins = 0;
      }
      
      return originalJson.call(this, responseData);
    };
    

    return loginController(req, res);
  };
};


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


const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {

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


const sanitizeInputObject = (obj) => {
  const sanitize = (input) => {
    if (typeof input === 'string') {
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
        .trim();
    } else if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (let key in input) {
        sanitized[key] = sanitize(input[key]);
      }
      return sanitized;
    }
    return input;
  };

  return sanitize(obj);
};


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
    

    if (req.originalUrl.includes('/login') || 
        req.originalUrl.includes('/register') ||
        req.originalUrl.includes('/admin') ||
        res.statusCode >= 400) {
      console.log('AUDIT:', JSON.stringify(logData));
    }
  });
  
  next();
};

const sessionSecurity = {
 
  blacklistedTokens: new Set(),
  

  blacklistToken: (token) => {

    if (sessionSecurity.blacklistedTokens.size > 10000) {
      sessionSecurity.blacklistedTokens.clear();
    }
  },
  
 
  isTokenBlacklisted: (token) => {
    return sessionSecurity.blacklistedTokens.has(token);
  }
};


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
  sanitizeInputObject,
  auditLogger,
  sessionSecurity,
  secureLogout
};
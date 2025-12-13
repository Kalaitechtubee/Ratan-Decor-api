// middleware/cookieOptions.js - CORRECTED VERSION
const getCookieOptions = (maxAge = null) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = !isProduction;
  
  // For local development (localhost → localhost OR localhost → remote)
  if (isDevelopment) {
    return {
      httpOnly: true,
      secure: false,           // HTTP in development
      sameSite: 'Lax',         // Lax works for same-site OR cross-site top-level navigation
      path: '/',
      ...(maxAge ? { maxAge } : {})
    };
  }
  
  // For production (HTTPS required)
  return {
    httpOnly: true,
    secure: true,              // HTTPS in production
    sameSite: 'None',          // None requires secure: true
    path: '/',
    ...(maxAge ? { maxAge } : {})
  };
};

module.exports = { getCookieOptions };
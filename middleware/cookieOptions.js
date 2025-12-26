// middleware/cookieOptions.js
const getCookieOptions = (maxAge = null) => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Development
    return {
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      path: '/',
      ...(maxAge ? { maxAge } : {})
    };
  }

  // Production
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    ...(maxAge ? { maxAge } : {})
  };
};

module.exports = { getCookieOptions };

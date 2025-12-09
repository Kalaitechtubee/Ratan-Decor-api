// cookieOptions.js
const getCookieOptions = (maxAge = null) => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    path: '/',
    ...(maxAge ? { maxAge } : {})
  };
};

module.exports = { getCookieOptions };

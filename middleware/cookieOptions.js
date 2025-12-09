// Centralized cookie option helper to ensure consistent settings for set/clear
const getCookieOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    ...(maxAge ? { maxAge } : {}),
    path: '/',
  };
};

module.exports = { getCookieOptions };


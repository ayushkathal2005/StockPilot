const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AppError } = require('./errorHandler');

/**
 * Authentication middleware.
 * Verifies JWT token from Authorization header or HTTP-only cookie.
 */
function authenticate(req, res, next) {
  let token = null;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 
  // 2. Check HTTP-only cookie as fallback
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new AppError('Authentication required. No access token provided.', 401, 'UNAUTHORIZED'));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      fullName: decoded.fullName
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Session expired. Please log in again.', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid authentication token.', 401, 'INVALID_TOKEN'));
  }
}

module.exports = {
  authenticate
};

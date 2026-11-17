const morgan = require('morgan');

// Tokens to redact in query strings or body logs
const SENSITIVE_FIELDS = ['password', 'password_hash', 'token', 'jwt', 'secret', 'authorization'];

/**
 * Sanitizes object by masking sensitive credential fields.
 */
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Custom morgan token to log client IP safely
morgan.token('client-ip', (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress);

const requestLogger = morgan(':method :url :status :res[content-length] - :response-time ms [:client-ip]', {
  skip: (req) => req.url === '/api/health' && process.env.NODE_ENV === 'test'
});

module.exports = {
  requestLogger,
  sanitize
};

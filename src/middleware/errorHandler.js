const { ZodError } = require('zod');

/**
 * Custom application operational error class.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Centralized Express Error Handling Middleware.
 * Never leaks database connection strings, passwords, or raw SQL stack traces.
 */
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected internal server error occurred.';
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.details || null;

  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request payload validation failed.';
    details = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
  }

  // Handle SQL Server / mssql driver errors safely
  if (err.name === 'RequestError' || err.name === 'ConnectionError') {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    message = 'A database operation failed. Please check parameters or retry shortly.';
    details = process.env.NODE_ENV === 'development' ? err.message : null;
  }

  // Handle JSON parsing errors in body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON payload in request body.';
  }

  // Log error (suppressing stack traces for expected client errors)
  if (statusCode >= 500) {
    console.error(`[SERVER_ERROR] [${req.method} ${req.originalUrl}]:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      details,
      timestamp: new Date().toISOString()
    }
  });
}

module.exports = {
  AppError,
  errorHandler
};

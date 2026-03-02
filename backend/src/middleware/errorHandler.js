/**
 * @fileoverview Global Express error-handling middleware.
 *
 * Must be registered LAST (after all routes) so Express recognises it as the
 * error handler (four-argument signature).  Catches synchronous throws and
 * errors forwarded via `next(err)`.
 *
 * Security: database connection strings, internal stack traces, and other
 * sensitive details are never included in the HTTP response body.
 */

'use strict';

/**
 * Centralised error handler.
 *
 * @param {Error}                      err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next  - required by Express signature
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // Always log the full error server-side for debugging
  console.error('[Error]', {
    method: req.method,
    url: req.originalUrl,
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: err.errors,
    });
  }

  // JWT errors are already handled in auth.js; include as a safety net
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }

  // Use the status code set on the error object, or default to 500
  const statusCode = typeof err.status === 'number' ? err.status : 500;

  return res.status(statusCode).json({
    status: 'error',
    // Never expose internal details in production
    message:
      statusCode === 500 && process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred'
        : err.message || 'An unexpected error occurred',
  });
}

module.exports = { errorHandler };

/**
 * @fileoverview JWT authentication middleware.
 *
 * Extracts a Bearer token from the `Authorization` header, verifies it
 * against `JWT_SECRET`, and attaches the decoded payload to `req.user`.
 * Returns HTTP 401 for missing or invalid tokens so that downstream
 * handlers can assume `req.user` is always populated.
 */

'use strict';

const jwt = require('jsonwebtoken');

/**
 * Express middleware that enforces JWT authentication.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ status: 'error', message: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };

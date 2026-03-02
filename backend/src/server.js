/**
 * @fileoverview VahiNav Express API server entry point.
 *
 * Bootstraps the application in the following order:
 *  1. Load environment variables from .env
 *  2. Initialise PostgreSQL connection pool
 *  3. Initialise Firebase Admin SDK
 *  4. Configure Express middleware (CORS, body-parser, rate limiting)
 *  5. Register routes (health, trips, nudge, admin)
 *  6. Register global error handler
 *  7. Start listening on PORT
 *
 * All route handlers receive the shared `pool` and `adminApp` instances via
 * closure so they can be tested independently without importing singletons.
 */

'use strict';

// ---------------------------------------------------------------------------
// 1. Environment variables — must be loaded before any other module reads them
// ---------------------------------------------------------------------------
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

const { pool, testConnection } = require('./config/database');
const { initializeFirebase } = require('./config/firebase');
const { authenticate } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Route factories
const { createTripRouter } = require('./routes/tripRoutes');
const { createAdminRouter } = require('./routes/adminRoutes');

// Controllers still used as inline handlers (nudge)
const { sendNudge } = require('./controllers/nudgeController');

// ---------------------------------------------------------------------------
// 2. Initialise Firebase Admin SDK
// ---------------------------------------------------------------------------
let adminApp;
try {
  adminApp = initializeFirebase();
} catch (err) {
  logger.warn('Firebase', 'Initialisation skipped:', err.message);
  adminApp = null; // Graceful degradation — server still starts; nudges will fail
}

// ---------------------------------------------------------------------------
// 3. Express application
// ---------------------------------------------------------------------------
const app = express();

/**
 * CORS — allow the Flutter app (and the React dashboard) to call the API.
 * In production restrict `origin` to known domains.
 */
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

/** Parse JSON and URL-encoded request bodies (body-parser is included per project spec) */
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: false }));

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

/**
 * General API rate limiter — 300 requests per minute per IP.
 * Applied to all /api/v1 routes.
 */
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests — please try again later' },
});

/**
 * Stricter limiter for the breadcrumb sync endpoint — 100 requests per minute
 * per IP (as specified in the security requirements).
 */
const syncLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Sync rate limit exceeded — please slow down' },
});

app.use('/api/v1', apiLimiter);

/** Log every incoming request with response time */
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.request(req.method, req.originalUrl, res.statusCode, Date.now() - start);
  });
  next();
});

// ---------------------------------------------------------------------------
// 4. Routes
// ---------------------------------------------------------------------------

/**
 * GET /health
 *
 * Simple liveness probe — returns 200 with server timestamp.
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/v1/trips/sync + POST /api/v1/trips/complete + GET /api/v1/trips/:tripId
 */
app.use('/api/v1/trips', syncLimiter, createTripRouter(pool, adminApp));

/**
 * GET /api/v1/admin/spatial-data + modal-split + trip-chains
 */
app.use('/api/v1/admin', createAdminRouter(pool));

/**
 * POST /api/v1/nudge/send
 *
 * Admin endpoint to manually trigger an FCM push notification.
 * Protected by JWT middleware.
 */
app.post('/api/v1/nudge/send', authenticate, async (req, res, next) => {
  try {
    await sendNudge(req, res, pool, adminApp);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 5. Global error handler — must be registered after all routes
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// 6. Start server
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '8000', 10);

app.listen(PORT, async () => {
  logger.info('Server', `VahiNav API listening on port ${PORT} (${process.env.NODE_ENV})`);
  await testConnection(); // Verify DB connectivity on startup
});

module.exports = app; // Export for testing


/**
 * @fileoverview VahiNav Express API server entry point.
 *
 * Bootstraps the application in the following order:
 *  1. Load environment variables from .env
 *  2. Initialise PostgreSQL connection pool
 *  3. Initialise Firebase Admin SDK
 *  4. Configure Express middleware (CORS, JSON body parser)
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
const rateLimit = require('express-rate-limit');

const { pool, testConnection } = require('./config/database');
const { initializeFirebase } = require('./config/firebase');
const { authenticate } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

// Controllers
const { syncBreadcrumbs } = require('./controllers/tripController');
const { sendNudge } = require('./controllers/nudgeController');
const { getSpatialData, getModalSplit, getTripChains } = require('./controllers/adminController');

// ---------------------------------------------------------------------------
// 2. Initialise Firebase Admin SDK
// ---------------------------------------------------------------------------
let adminApp;
try {
  adminApp = initializeFirebase();
} catch (err) {
  console.warn('[Firebase] Initialisation skipped:', err.message);
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

/** Parse JSON request bodies */
app.use(express.json({ limit: '1mb' }));

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

/** Log every incoming request */
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
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
 * POST /api/v1/trips/sync
 *
 * Flutter background service sends batches of GPS breadcrumbs here.
 * Protected by JWT middleware.
 */
app.post('/api/v1/trips/sync', syncLimiter, authenticate, async (req, res, next) => {
  try {
    await syncBreadcrumbs(req, res, pool, adminApp);
  } catch (err) {
    next(err);
  }
});

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

/**
 * GET /api/v1/admin/spatial-data
 *
 * Returns a GeoJSON FeatureCollection of completed trip paths for the dashboard.
 * Protected by JWT middleware.
 */
app.get('/api/v1/admin/spatial-data', authenticate, async (req, res, next) => {
  try {
    await getSpatialData(req, res, pool);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/modal-split
 *
 * Returns travel-mode breakdown for pie-chart visualisation.
 * Protected by JWT middleware.
 */
app.get('/api/v1/admin/modal-split', authenticate, async (req, res, next) => {
  try {
    await getModalSplit(req, res, pool);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/trip-chains
 *
 * Returns chronological trip chains per user for the dashboard.
 * Protected by JWT middleware.
 */
app.get('/api/v1/admin/trip-chains', authenticate, async (req, res, next) => {
  try {
    await getTripChains(req, res, pool);
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
const PORT = parseInt(process.env.PORT || '8080', 10);

app.listen(PORT, async () => {
  console.log(`[Server] VahiNav API listening on port ${PORT} (${process.env.NODE_ENV})`);
  await testConnection(); // Verify DB connectivity on startup
});

module.exports = app; // Export for testing

/**
 * @fileoverview Trip-related Express routes.
 *
 * Routes:
 *   POST /api/v1/trips/sync        → syncBreadcrumbs  (auth required)
 *   POST /api/v1/trips/complete    → completeTrip     (auth required)
 *   GET  /api/v1/trips/:tripId     → getTripDetails   (auth required)
 *
 * The `pool` and `adminApp` dependencies are injected via a factory function
 * so that routes can be unit-tested without real database / Firebase
 * connections.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const {
  syncBreadcrumbs,
  completeTrip,
  getTripDetails,
} = require('../controllers/tripController');

/**
 * Create and return a configured trips router.
 *
 * @param {import('pg').Pool}                pool
 * @param {import('firebase-admin').app.App} adminApp
 * @returns {import('express').Router}
 */
function createTripRouter(pool, adminApp) {
  const router = Router();

  /**
   * POST /api/v1/trips/sync
   *
   * Flutter background service sends batches of GPS breadcrumbs here.
   */
  router.post('/sync', authenticate, async (req, res, next) => {
    try {
      await syncBreadcrumbs(req, res, pool, adminApp);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/trips/complete
   *
   * Marks a trip as completed and runs final dwell detection.
   */
  router.post('/complete', authenticate, async (req, res, next) => {
    try {
      await completeTrip(req, res, pool, adminApp);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/trips/:tripId
   *
   * Fetch a single trip with its breadcrumbs (for debugging / driver review).
   */
  router.get('/:tripId', authenticate, async (req, res, next) => {
    try {
      await getTripDetails(req, res, pool);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createTripRouter };

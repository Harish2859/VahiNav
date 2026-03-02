/**
 * @fileoverview Admin dashboard Express routes.
 *
 * Routes:
 *   GET /api/v1/admin/spatial-data  → getSpatialData  (auth required)
 *   GET /api/v1/admin/modal-split   → getModalSplit   (auth required)
 *   GET /api/v1/admin/trip-chains   → getTripChains   (auth required)
 *
 * The `pool` dependency is injected via a factory function so that routes
 * can be unit-tested without a real database connection.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getSpatialData,
  getModalSplit,
  getTripChains,
} = require('../controllers/adminController');

/**
 * Create and return a configured admin router.
 *
 * @param {import('pg').Pool} pool
 * @returns {import('express').Router}
 */
function createAdminRouter(pool) {
  const router = Router();

  /**
   * GET /api/v1/admin/spatial-data
   *
   * Returns a GeoJSON FeatureCollection of completed trip paths for the
   * React dashboard map.
   */
  router.get('/spatial-data', authenticate, async (req, res, next) => {
    try {
      await getSpatialData(req, res, pool);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/admin/modal-split
   *
   * Returns travel-mode counts suitable for a pie/doughnut chart.
   * Response: { bus: 150, car: 300, walk: 80, ... }
   */
  router.get('/modal-split', authenticate, async (req, res, next) => {
    try {
      await getModalSplit(req, res, pool);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/admin/trip-chains
   *
   * Returns chronological trip chains grouped by anonymised user ID.
   */
  router.get('/trip-chains', authenticate, async (req, res, next) => {
    try {
      await getTripChains(req, res, pool);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAdminRouter };

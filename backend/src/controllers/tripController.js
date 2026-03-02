/**
 * @fileoverview Trip ingestion controller.
 *
 * Handles the `POST /api/v1/trips/sync` endpoint which is called by the
 * Flutter background service to batch-upload GPS breadcrumbs.
 *
 * Processing pipeline:
 *  1. Validate the request body with Zod
 *  2. Insert each breadcrumb into PostGIS (ST_MakePoint with lon, lat)
 *  3. Rebuild the trip LINESTRING with ST_MakeLine
 *  4. Run dwell detection — if stationary >5 min, trigger FCM nudge
 */

'use strict';

const { z } = require('zod');
const { SyncRequestSchema } = require('../validators/breadcrumbSchema');
const {
  insertBreadcrumb,
  updateTripPath,
  getDwellStatus,
  calculateTripDistance,
} = require('../models/postgisQueries');
const { sendNudgeToUser } = require('../services/fcmService');
const { getFcmToken } = require('../utils/userUtils');

// ---------------------------------------------------------------------------
// Additional Zod schemas specific to this controller
// ---------------------------------------------------------------------------

/** Schema for POST /api/v1/trips/complete */
const CompleteTripSchema = z.object({
  userId: z.number().int().positive(),
  tripId: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Controller exports
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/trips/sync
 *
 * Accepts a batch of GPS breadcrumbs from the Flutter app, persists them to
 * PostGIS, rebuilds the trip path, and runs dwell detection.
 *
 * @param {import('express').Request}  req  - Expects validated JWT → req.user
 * @param {import('express').Response} res
 * @param {import('pg').Pool}          pool
 * @param {import('firebase-admin').app.App} adminApp
 */
async function syncBreadcrumbs(req, res, pool, adminApp) {
  // 1. Validate the incoming payload
  const parseResult = SyncRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parseResult.error.errors,
    });
  }

  const { userId, tripId, breadcrumbs } = parseResult.data;

  // 2. Verify the trip belongs to the authenticated user (security check)
  const { rows: tripRows } = await pool.query(
    'SELECT id, user_id FROM trips WHERE id = $1',
    [tripId],
  );
  if (tripRows.length === 0) {
    return res.status(404).json({ status: 'error', message: 'Trip not found' });
  }
  if (tripRows[0].user_id !== userId) {
    return res.status(403).json({ status: 'error', message: 'Trip does not belong to user' });
  }

  // 3. Insert breadcrumbs — use lon/lat order for PostGIS
  const insertPromises = breadcrumbs.map((b) =>
    insertBreadcrumb(pool, tripId, b.longitude, b.latitude, b.speed ?? null, b.timestamp),
  );
  await Promise.all(insertPromises);

  // 4. Rebuild the trip's LINESTRING path
  await updateTripPath(pool, tripId);

  // 5. Recalculate total distance and persist it
  const totalDistance = await calculateTripDistance(pool, tripId);
  await pool.query(
    'UPDATE trips SET total_distance = $1, updated_at = NOW() WHERE id = $2',
    [totalDistance, tripId],
  );

  // 6. Dwell detection → FCM nudge
  await checkDwellAndNudge(tripId, userId, pool, adminApp);

  return res.status(200).json({
    status: 'success',
    tripId,
    breadcrumbsInserted: breadcrumbs.length,
    totalDistanceMetres: totalDistance,
  });
}

/**
 * Check whether the user is dwelling (stationary >5 min within 100 m radius).
 * If so, send an FCM nudge and mark the trip as completed.
 *
 * This function is intentionally fire-and-forget from the caller's perspective;
 * errors are caught and logged rather than surfaced to the HTTP response.
 *
 * @param {number} tripId
 * @param {number} userId
 * @param {import('pg').Pool} pool
 * @param {import('firebase-admin').app.App} adminApp
 * @returns {Promise<void>}
 */
async function checkDwellAndNudge(tripId, userId, pool, adminApp) {
  try {
    const { isDwelling, durationSeconds, distanceMetres } = await getDwellStatus(pool, tripId);

    if (!isDwelling) return;

    console.log(
      `[Dwell] userId=${userId} tripId=${tripId} | dist=${distanceMetres.toFixed(1)}m dur=${Math.round(durationSeconds)}s → sending nudge`,
    );

    // Fetch FCM token
    const fcmToken = await getFcmToken(pool, userId);
    if (fcmToken) {
      await sendNudgeToUser(
        userId,
        fcmToken,
        {
          title: 'Have you arrived? 🗺️',
          body: 'Tell us about your journey — it only takes a moment!',
          data: { tripId: String(tripId), action: 'SURVEY_PROMPT' },
        },
        adminApp,
      );
    } else {
      console.warn(`[Dwell] No FCM token for userId=${userId}; nudge skipped`);
    }

    // Mark trip as completed
    await pool.query(
      `UPDATE trips SET status = 'completed', end_time = NOW(), updated_at = NOW() WHERE id = $1`,
      [tripId],
    );
  } catch (err) {
    console.error('[Dwell] Error in checkDwellAndNudge:', err.message);
  }
}

/**
 * POST /api/v1/trips/complete
 *
 * Marks a trip as completed.  Runs a final dwell check and sends an FCM
 * nudge if the user is still stationary.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('pg').Pool}          pool
 * @param {import('firebase-admin').app.App} adminApp
 */
async function completeTrip(req, res, pool, adminApp) {
  const parseResult = CompleteTripSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parseResult.error.errors,
    });
  }

  const { userId, tripId } = parseResult.data;

  // Verify the trip exists and belongs to the authenticated user
  const { rows: tripRows } = await pool.query(
    'SELECT id, user_id, status FROM trips WHERE id = $1',
    [tripId],
  );
  if (tripRows.length === 0) {
    return res.status(404).json({ status: 'error', message: 'Trip not found' });
  }
  if (tripRows[0].user_id !== userId) {
    return res.status(403).json({ status: 'error', message: 'Trip does not belong to user' });
  }
  if (tripRows[0].status === 'completed') {
    return res.status(409).json({ status: 'error', message: 'Trip is already completed' });
  }

  // Final dwell check → nudge if stationary
  await checkDwellAndNudge(tripId, userId, pool, adminApp);

  // Mark the trip as completed (checkDwellAndNudge may have already done so)
  await pool.query(
    `UPDATE trips SET status = 'completed', end_time = COALESCE(end_time, NOW()), updated_at = NOW() WHERE id = $1`,
    [tripId],
  );

  // Return final distance
  const totalDistance = await calculateTripDistance(pool, tripId);

  return res.status(200).json({
    status: 'completed',
    tripId,
    totalDistanceMetres: totalDistance,
  });
}

/**
 * GET /api/v1/trips/:tripId
 *
 * Returns trip metadata plus its breadcrumbs — useful for debugging and
 * driver review in the Flutter app.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('pg').Pool}          pool
 */
async function getTripDetails(req, res, pool) {
  const tripId = parseInt(req.params.tripId, 10);
  if (Number.isNaN(tripId) || tripId <= 0) {
    return res.status(400).json({ status: 'error', message: 'Invalid tripId' });
  }

  const { rows: tripRows } = await pool.query(
    `SELECT id, user_id, start_time, end_time, travel_mode, trip_purpose,
            total_distance, status, created_at, updated_at
     FROM trips WHERE id = $1`,
    [tripId],
  );
  if (tripRows.length === 0) {
    return res.status(404).json({ status: 'error', message: 'Trip not found' });
  }

  const trip = tripRows[0];

  // Restrict access to the trip owner
  if (req.user && req.user.userId !== trip.user_id) {
    return res.status(403).json({ status: 'error', message: 'Forbidden' });
  }

  const { rows: breadcrumbs } = await pool.query(
    `SELECT id, speed, recorded_at,
            ST_X(location::geometry) AS longitude,
            ST_Y(location::geometry) AS latitude
     FROM breadcrumbs
     WHERE trip_id = $1
     ORDER BY recorded_at ASC`,
    [tripId],
  );

  return res.status(200).json({
    status: 'ok',
    trip: {
      ...trip,
      breadcrumbs,
    },
  });
}

module.exports = { syncBreadcrumbs, completeTrip, getTripDetails };

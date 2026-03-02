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
const {
  insertBreadcrumb,
  updateTripPath,
  getDwellStatus,
  calculateTripDistance,
} = require('../models/postgisQueries');
const { sendNudgeToUser } = require('../services/fcmService');
const { getFcmToken } = require('../utils/userUtils');

// ---------------------------------------------------------------------------
// Zod schema — validates the body sent by the Flutter app
// ---------------------------------------------------------------------------

/** A single GPS reading from the device */
const BreadcrumbSchema = z.object({
  /** Longitude — PostGIS uses (lon, lat) order */
  longitude: z.number().min(-180).max(180),
  /** Latitude */
  latitude: z.number().min(-90).max(90),
  /** Speed in metres per second (nullable — some devices omit it) */
  speed: z.number().nullable().optional(),
  /** ISO-8601 UTC timestamp recorded by the device */
  timestamp: z.string().datetime(),
});

/** Full sync request body */
const SyncRequestSchema = z.object({
  userId: z.number().int().positive(),
  tripId: z.number().int().positive(),
  breadcrumbs: z.array(BreadcrumbSchema).min(1),
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

module.exports = { syncBreadcrumbs };

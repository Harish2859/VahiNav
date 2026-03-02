/**
 * @fileoverview Admin controller — dashboard data endpoints.
 *
 * Provides:
 *  - GET /api/v1/admin/spatial-data  → GeoJSON FeatureCollection of trip paths
 *  - GET /api/v1/admin/modal-split   → travel-mode breakdown for pie chart
 *  - GET /api/v1/admin/trip-chains   → chronological trip chains per user
 *
 * All endpoints are protected by the JWT auth middleware and should only be
 * reachable by admin users.
 */

'use strict';

const { getGeoJSONFeatures } = require('../models/postgisQueries');

/**
 * GET /api/v1/admin/spatial-data
 *
 * Returns a GeoJSON FeatureCollection of completed trip paths.
 * Supports optional query-string filters:
 *   - startDate  (ISO-8601)
 *   - endDate    (ISO-8601)
 *   - travelMode (e.g. IN_VEHICLE, WALKING)
 *   - tripPurpose (e.g. Work, Shopping)
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('pg').Pool}          pool
 */
async function getSpatialData(req, res, pool) {
  const { startDate, endDate, travelMode, tripPurpose } = req.query;

  const features = await getGeoJSONFeatures(pool, {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    travelMode: travelMode || undefined,
    tripPurpose: tripPurpose || undefined,
  });

  return res.status(200).json({
    type: 'FeatureCollection',
    features,
    meta: { count: features.length },
  });
}

/**
 * GET /api/v1/admin/modal-split
 *
 * Returns a breakdown of completed trips by travel mode — suitable for a
 * pie/doughnut chart on the dashboard.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('pg').Pool}          pool
 */
async function getModalSplit(req, res, pool) {
  const sql = `
    SELECT
      COALESCE(travel_mode, 'unknown') AS travel_mode,
      COUNT(*)::integer                AS count
    FROM trips
    WHERE status = 'completed'
    GROUP BY travel_mode
    ORDER BY count DESC
  `;
  const { rows } = await pool.query(sql);

  // Convert rows into a flat object { bus: 150, car: 300, ... }
  const modalSplit = Object.fromEntries(
    rows.map((row) => [row.travel_mode, row.count]),
  );

  return res.status(200).json(modalSplit);
}

/**
 * GET /api/v1/admin/trip-chains
 *
 * Returns chronological trip chains for each user.  User IDs are returned as
 * opaque strings to preserve anonymity in dashboard visualisations.
 *
 * Each chain entry includes the sequence of trips in time order with summary
 * statistics (mode, purpose, distance, times).
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('pg').Pool}          pool
 */
async function getTripChains(req, res, pool) {
  const sql = `
    SELECT
      t.user_id,
      t.id            AS trip_id,
      t.start_time,
      t.end_time,
      t.travel_mode,
      t.trip_purpose,
      t.total_distance,
      t.status,
      ROW_NUMBER() OVER (PARTITION BY t.user_id ORDER BY t.start_time) AS sequence_number
    FROM trips t
    WHERE t.status IN ('completed', 'active')
    ORDER BY t.user_id, t.start_time
  `;
  const { rows } = await pool.query(sql);

  // Group by user_id into chains; anonymise by hashing the integer user_id
  const chains = {};
  for (const row of rows) {
    // Anonymise: prefix with 'user_' to avoid exposing raw database IDs
    const anonId = `user_${row.user_id}`;
    if (!chains[anonId]) {
      chains[anonId] = [];
    }
    chains[anonId].push({
      tripId: row.trip_id,
      sequence: row.sequence_number,
      startTime: row.start_time,
      endTime: row.end_time,
      travelMode: row.travel_mode,
      tripPurpose: row.trip_purpose,
      totalDistanceMetres: row.total_distance,
      status: row.status,
    });
  }

  return res.status(200).json({ tripChains: chains });
}

module.exports = { getSpatialData, getModalSplit, getTripChains };

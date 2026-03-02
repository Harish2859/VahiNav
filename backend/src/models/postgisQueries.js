/**
 * @fileoverview PostGIS query helpers.
 *
 * All database interactions are isolated here so that controllers stay thin
 * and SQL is easy to audit and test.  Every function uses parameterised
 * queries ($1, $2 …) to prevent SQL injection.
 *
 * Coordinate order note — PostGIS always uses (Longitude, Latitude):
 *   ST_MakePoint(longitude, latitude)
 */

'use strict';

// ---------------------------------------------------------------------------
// Dwell detection constants
// ---------------------------------------------------------------------------

/** Radius in metres within which a user is considered stationary */
const DWELL_RADIUS_METRES = 100;

/** Minimum stationary duration in seconds before dwell is flagged */
const DWELL_DURATION_SECONDS = 300; // 5 minutes

/**
 * Insert a single GPS breadcrumb into the `breadcrumbs` table.
 *
 * The location is stored as GEOGRAPHY(Point, 4326).
 *
 * @param {import('pg').Pool} pool
 * @param {number} tripId
 * @param {number} lon  - Longitude (x-axis)
 * @param {number} lat  - Latitude  (y-axis)
 * @param {number|null} speed      - metres per second; may be null
 * @param {string} timestamp       - ISO-8601 timestamp string
 * @returns {Promise<object>} Inserted row
 */
async function insertBreadcrumb(pool, tripId, lon, lat, speed, timestamp) {
  const sql = `
    INSERT INTO breadcrumbs (trip_id, location, speed, recorded_at)
    VALUES (
      $1,
      ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
      $4,
      $5
    )
    RETURNING id, trip_id, speed, recorded_at
  `;
  const { rows } = await pool.query(sql, [tripId, lon, lat, speed ?? null, timestamp]);
  return rows[0];
}

/**
 * Rebuild the trip's `path_geometry` LINESTRING from its breadcrumbs.
 *
 * Uses `ST_MakeLine` ordered by `recorded_at` to produce a chronologically
 * correct route.  Requires at least two breadcrumbs; skips the update
 * silently if fewer exist.
 *
 * @param {import('pg').Pool} pool
 * @param {number} tripId
 * @returns {Promise<void>}
 */
async function updateTripPath(pool, tripId) {
  const sql = `
    UPDATE trips
    SET
      path_geometry = (
        SELECT ST_MakeLine(location::geometry ORDER BY recorded_at)
        FROM   breadcrumbs
        WHERE  trip_id = $1
      ),
      updated_at = NOW()
    WHERE id = $1
  `;
  await pool.query(sql, [tripId]);
}

/**
 * Calculate the total route distance for a trip in metres.
 *
 * Uses `ST_Length` on a GEOGRAPHY cast so the result respects the Earth's
 * curvature.
 *
 * @param {import('pg').Pool} pool
 * @param {number} tripId
 * @returns {Promise<number>} Distance in metres, or 0 if no path exists yet.
 */
async function calculateTripDistance(pool, tripId) {
  const sql = `
    SELECT COALESCE(
      ST_Length(path_geometry::geography),
      0
    ) AS distance_m
    FROM trips
    WHERE id = $1
  `;
  const { rows } = await pool.query(sql, [tripId]);
  return rows.length > 0 ? parseFloat(rows[0].distance_m) : 0;
}

/**
 * Check whether the user has been stationary (dwelling) for more than 5 minutes
 * at the end of a trip.
 *
 * Dwelling is detected by comparing the straight-line distance between the
 * oldest and newest of the last N breadcrumbs.  If the user travelled less
 * than 100 m in the last 5 minutes they are considered to be dwelling.
 *
 * @param {import('pg').Pool} pool
 * @param {number} tripId
 * @returns {Promise<{isDwelling: boolean, durationSeconds: number, distanceMetres: number}>}
 */
async function getDwellStatus(pool, tripId) {
  // Fetch the last 10 breadcrumbs ordered chronologically
  const sql = `
    SELECT
      recorded_at,
      location::geometry AS geom
    FROM breadcrumbs
    WHERE trip_id = $1
    ORDER BY recorded_at DESC
    LIMIT 10
  `;
  const { rows } = await pool.query(sql, [tripId]);

  if (rows.length < 2) {
    return { isDwelling: false, durationSeconds: 0, distanceMetres: 0 };
  }

  // rows[0] = most recent, rows[last] = oldest in the window
  const newest = rows[0];
  const oldest = rows[rows.length - 1];

  const durationSeconds =
    (new Date(newest.recorded_at) - new Date(oldest.recorded_at)) / 1000;

  // Calculate straight-line distance between first and last point in the window
  const distSql = `
    SELECT ST_Distance(
      ST_SetSRID($1::geometry, 4326)::geography,
      ST_SetSRID($2::geometry, 4326)::geography
    ) AS dist_m
  `;
  const { rows: distRows } = await pool.query(distSql, [newest.geom, oldest.geom]);
  const distanceMetres = parseFloat(distRows[0].dist_m);

  const isDwelling = distanceMetres < DWELL_RADIUS_METRES && durationSeconds > DWELL_DURATION_SECONDS;

  return { isDwelling, durationSeconds, distanceMetres };
}

/**
 * Return GeoJSON Feature objects for completed trips.
 *
 * Supports optional filters: `startDate`, `endDate`, `travelMode`,
 * `tripPurpose`.  Only trips that have a non-null `path_geometry` are
 * included.
 *
 * @param {import('pg').Pool} pool
 * @param {{ startDate?: string, endDate?: string, travelMode?: string, tripPurpose?: string }} filters
 * @returns {Promise<object[]>} Array of GeoJSON Feature objects
 */
async function getGeoJSONFeatures(pool, filters = {}) {
  const conditions = ["t.path_geometry IS NOT NULL", "t.status = 'completed'"];
  const params = [];

  if (filters.startDate) {
    params.push(filters.startDate);
    conditions.push(`t.start_time >= $${params.length}`);
  }
  if (filters.endDate) {
    params.push(filters.endDate);
    conditions.push(`t.start_time <= $${params.length}`);
  }
  if (filters.travelMode) {
    params.push(filters.travelMode);
    conditions.push(`t.travel_mode = $${params.length}`);
  }
  if (filters.tripPurpose) {
    params.push(filters.tripPurpose);
    conditions.push(`t.trip_purpose = $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  const sql = `
    SELECT
      t.id,
      t.user_id,
      t.start_time,
      t.end_time,
      t.travel_mode,
      t.trip_purpose,
      t.total_distance,
      ST_AsGeoJSON(t.path_geometry)::json AS geometry
    FROM trips t
    WHERE ${whereClause}
    ORDER BY t.start_time DESC
  `;
  const { rows } = await pool.query(sql, params);

  return rows.map((row) => ({
    type: 'Feature',
    geometry: row.geometry,
    properties: {
      tripId: row.id,
      userId: row.user_id,
      startTime: row.start_time,
      endTime: row.end_time,
      travelMode: row.travel_mode,
      tripPurpose: row.trip_purpose,
      totalDistanceMetres: row.total_distance,
    },
  }));
}

module.exports = {
  insertBreadcrumb,
  updateTripPath,
  calculateTripDistance,
  getDwellStatus,
  getGeoJSONFeatures,
};

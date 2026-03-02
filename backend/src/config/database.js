/**
 * @fileoverview PostgreSQL connection pool configuration.
 *
 * Creates a single shared `pg.Pool` instance from environment variables and
 * verifies connectivity on startup.  Import `pool` wherever database access
 * is needed — the pool handles connection reuse automatically.
 */

'use strict';

const { Pool } = require('pg');

/**
 * Shared PostgreSQL connection pool.
 *
 * Pool settings:
 *  - max: up to 10 concurrent connections (good for typical API load)
 *  - idleTimeoutMillis: idle connections are closed after 30 s
 *  - connectionTimeoutMillis: fail fast (2 s) rather than hanging indefinitely
 */
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'vahinav_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

/**
 * Verify the database connection on startup.
 * Logs success or an error message — does not crash the process so that the
 * server can still boot and surface a meaningful health-check failure.
 *
 * @returns {Promise<void>}
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    const { rows } = await client.query('SELECT NOW() AS now');
    client.release();
    console.log('[DB] Connected to PostgreSQL at', rows[0].now);
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
  }
}

module.exports = { pool, testConnection };

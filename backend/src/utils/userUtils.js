/**
 * @fileoverview Shared user utilities.
 *
 * Provides helper functions that are used by multiple controllers so that
 * business logic is not duplicated across the codebase.
 */

'use strict';

/**
 * Fetch the FCM device token for a user from the `users` table.
 *
 * The token is expected to be stored in `preferences->>'fcmToken'`.
 * Returns `null` when no token is available (user not registered for push).
 *
 * @param {import('pg').Pool} pool
 * @param {number} userId
 * @returns {Promise<string|null>}
 */
async function getFcmToken(pool, userId) {
  const { rows } = await pool.query(
    `SELECT preferences->>'fcmToken' AS fcm_token FROM users WHERE id = $1`,
    [userId],
  );
  return rows.length > 0 ? rows[0].fcm_token : null;
}

module.exports = { getFcmToken };

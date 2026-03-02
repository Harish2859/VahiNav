/**
 * @fileoverview Firebase Cloud Messaging (FCM) service helpers.
 *
 * Wraps `firebase-admin` messaging calls with retry logic and structured
 * logging so that controllers stay thin and FCM interactions are auditable.
 */

'use strict';

/** Maximum number of send attempts before giving up */
const MAX_RETRIES = 3;

/** Base delay between retries in milliseconds (doubles on each attempt) */
const RETRY_BASE_DELAY_MS = 500;

/**
 * Wait for a given number of milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send an FCM push notification to a specific device token.
 *
 * Retries up to MAX_RETRIES times with exponential back-off on transient
 * errors.  Logs success and failure details to stdout/stderr.
 *
 * @param {string} userId      - For logging purposes only
 * @param {string} deviceToken - FCM registration token for the target device
 * @param {{ title: string, body: string, data?: Record<string, string> }} message
 * @param {import('firebase-admin').app.App} adminApp - Initialised Firebase Admin app
 * @returns {Promise<string>} FCM message ID on success
 * @throws {Error} After all retry attempts are exhausted
 */
async function sendNudgeToUser(userId, deviceToken, message, adminApp) {
  const fcmMessage = {
    token: deviceToken,
    notification: {
      title: message.title,
      body: message.body,
    },
    data: message.data || {},
    android: {
      priority: 'high',
    },
    apns: {
      payload: {
        aps: { contentAvailable: true },
      },
    },
  };

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const messageId = await adminApp.messaging().send(fcmMessage);
      console.log(
        `[FCM] ✓ Sent nudge to userId=${userId} | messageId=${messageId}`,
      );
      return messageId;
    } catch (err) {
      lastError = err;
      console.warn(
        `[FCM] Attempt ${attempt}/${MAX_RETRIES} failed for userId=${userId}: ${err.message}`,
      );
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }

  console.error(
    `[FCM] ✗ All ${MAX_RETRIES} attempts failed for userId=${userId}: ${lastError.message}`,
  );
  throw lastError;
}

/**
 * Send an FCM push notification to a named topic (e.g. all active users).
 *
 * Retries with the same exponential back-off strategy as `sendNudgeToUser`.
 *
 * @param {string} topicName
 * @param {{ title: string, body: string, data?: Record<string, string> }} message
 * @param {import('firebase-admin').app.App} adminApp
 * @returns {Promise<string>} FCM message ID on success
 * @throws {Error} After all retry attempts are exhausted
 */
async function sendNudgeToTopic(topicName, message, adminApp) {
  const fcmMessage = {
    topic: topicName,
    notification: {
      title: message.title,
      body: message.body,
    },
    data: message.data || {},
    android: { priority: 'high' },
  };

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const messageId = await adminApp.messaging().send(fcmMessage);
      console.log(
        `[FCM] ✓ Sent topic nudge to topic=${topicName} | messageId=${messageId}`,
      );
      return messageId;
    } catch (err) {
      lastError = err;
      console.warn(
        `[FCM] Attempt ${attempt}/${MAX_RETRIES} failed for topic=${topicName}: ${err.message}`,
      );
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }

  console.error(
    `[FCM] ✗ All ${MAX_RETRIES} attempts failed for topic=${topicName}: ${lastError.message}`,
  );
  throw lastError;
}

module.exports = { sendNudgeToUser, sendNudgeToTopic };

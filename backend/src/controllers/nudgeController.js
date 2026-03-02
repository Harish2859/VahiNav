/**
 * @fileoverview Nudge controller — manual FCM push notification trigger.
 *
 * Provides the `POST /api/v1/nudge/send` endpoint so that admins can fire
 * targeted or broadcast nudges without waiting for dwell detection.
 */

'use strict';

const { z } = require('zod');
const { sendNudgeToUser } = require('../services/fcmService');
const { getFcmToken } = require('../utils/userUtils');

/** Zod schema for the nudge request body */
const NudgeRequestSchema = z.object({
  userId: z.number().int().positive(),
  tripId: z.number().int().positive().optional(),
  message: z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(500),
    data: z.record(z.string()).optional(),
  }),
});

/**
 * POST /api/v1/nudge/send
 *
 * Manually sends an FCM push notification to a specific user.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('pg').Pool}          pool
 * @param {import('firebase-admin').app.App} adminApp
 */
async function sendNudge(req, res, pool, adminApp) {
  // Validate request body
  const parseResult = NudgeRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parseResult.error.errors,
    });
  }

  const { userId, tripId, message } = parseResult.data;

  // Look up the user's FCM token
  const fcmToken = await getFcmToken(pool, userId);
  if (!fcmToken) {
    return res.status(404).json({
      status: 'error',
      message: `No FCM token found for userId=${userId}`,
    });
  }

  // Send the notification
  const messageId = await sendNudgeToUser(userId, fcmToken, message, adminApp);

  return res.status(200).json({
    status: 'nudge sent',
    messageId,
    userId,
    tripId: tripId ?? null,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { sendNudge };

/**
 * @fileoverview Zod validation schemas for breadcrumb data.
 *
 * Centralises all Zod schemas so they can be reused across controllers
 * and tested in isolation.
 *
 * Coordinate ranges enforced:
 *   - longitude: -180 to 180
 *   - latitude:  -90  to 90
 */

'use strict';

const { z } = require('zod');

/**
 * Schema for a single GPS breadcrumb sent by the Flutter app.
 */
const BreadcrumbSchema = z.object({
  /** Longitude — PostGIS uses (lon, lat) order */
  longitude: z
    .number({ required_error: 'longitude is required', invalid_type_error: 'longitude must be a number' })
    .min(-180, { message: 'longitude must be >= -180' })
    .max(180, { message: 'longitude must be <= 180' }),

  /** Latitude */
  latitude: z
    .number({ required_error: 'latitude is required', invalid_type_error: 'latitude must be a number' })
    .min(-90, { message: 'latitude must be >= -90' })
    .max(90, { message: 'latitude must be <= 90' }),

  /** Speed in metres per second (optional — some devices omit it) */
  speed: z
    .number({ invalid_type_error: 'speed must be a number' })
    .nullable()
    .optional(),

  /** ISO-8601 UTC timestamp recorded by the device */
  timestamp: z
    .string({ required_error: 'timestamp is required' })
    .datetime({ message: 'timestamp must be a valid ISO-8601 date-time string' }),
});

/**
 * Schema for the full batch-sync request body sent to POST /api/v1/trips/sync.
 */
const SyncRequestSchema = z.object({
  userId: z
    .number({ required_error: 'userId is required', invalid_type_error: 'userId must be a number' })
    .int({ message: 'userId must be an integer' })
    .positive({ message: 'userId must be positive' }),

  tripId: z
    .number({ required_error: 'tripId is required', invalid_type_error: 'tripId must be a number' })
    .int({ message: 'tripId must be an integer' })
    .positive({ message: 'tripId must be positive' }),

  breadcrumbs: z
    .array(BreadcrumbSchema, { required_error: 'breadcrumbs array is required' })
    .min(1, { message: 'At least one breadcrumb is required' }),
});

module.exports = { BreadcrumbSchema, SyncRequestSchema };

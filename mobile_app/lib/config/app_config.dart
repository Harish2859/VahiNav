import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Central configuration class.
///
/// All backend URLs and tunable constants are defined here so that no URLs
/// are hardcoded throughout the codebase. Values are loaded from the `.env`
/// asset file at runtime.
class AppConfig {
  AppConfig._();

  // ---------------------------------------------------------------------------
  // Backend
  // ---------------------------------------------------------------------------

  /// Base URL of the Node.js API server (e.g. `https://api.pathsathi.in`).
  static String get backendBaseUrl =>
      dotenv.env['BACKEND_BASE_URL'] ?? 'http://localhost:3000';

  /// Full URL for the telemetry / breadcrumb sync endpoint.
  static String get tripsSyncUrl {
    final base = backendBaseUrl.endsWith('/')
        ? backendBaseUrl.substring(0, backendBaseUrl.length - 1)
        : backendBaseUrl;
    final path = dotenv.env['TRIPS_SYNC_ENDPOINT'] ?? '/api/v1/trips/sync';
    return '$base$path';
  }

  // ---------------------------------------------------------------------------
  // GPS & dwell detection
  // ---------------------------------------------------------------------------

  /// Minimum distance (metres) the device must move before a new breadcrumb
  /// is recorded. Keeps battery usage to ~1-2 %/hour.
  static const int gpsDistanceFilterMetres = 50;

  /// Radius (metres) used for dwell detection. If the user stays within this
  /// circle the trip is considered finished.
  static const double dwellRadiusMetres = 50.0;

  /// Time (minutes) the user must remain within [dwellRadiusMetres] before
  /// the app transitions to Stop Mode.
  static const int dwellDurationMinutes = 5;

  // ---------------------------------------------------------------------------
  // Hive box names
  // ---------------------------------------------------------------------------

  static const String hiveBoxBreadcrumbs = 'breadcrumbs';
  static const String hiveBoxTrips = 'trips';

  // ---------------------------------------------------------------------------
  // Sync retry
  // ---------------------------------------------------------------------------

  /// Initial delay for exponential backoff (seconds).
  static const int syncRetryInitialDelaySeconds = 5;

  /// Maximum number of sync retry attempts before giving up until the next
  /// connectivity change.
  static const int syncRetryMaxAttempts = 5;
}

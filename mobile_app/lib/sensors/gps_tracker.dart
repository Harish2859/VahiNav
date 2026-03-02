import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hive/hive.dart';

import '../config/app_config.dart';
import '../models/breadcrumb.dart';

/// Manages GPS acquisition and breadcrumb recording for an active trip.
///
/// **Battery strategy:**
/// - Uses a 50 m distance filter so the GPS hardware is only woken when the
///   device has moved, giving ~1-2 %/hour battery drain vs. 10 %+ for
///   constant polling.
/// - GPS is only active while [start] has been called and before [stop] is
///   called, i.e. only during confirmed active-movement windows.
///
/// **Dwell detection:**
/// - After each new position the last [_dwellSampleSize] breadcrumbs are
///   examined. If all of them fall within a [AppConfig.dwellRadiusMetres]
///   circle AND the first-to-last elapsed time exceeds
///   [AppConfig.dwellDurationMinutes], [onDwellDetected] is called.
class GpsTracker {
  /// Invoked when dwell detection triggers (user has stopped).
  final void Function() onDwellDetected;

  /// The trip currently being recorded.
  final String tripId;

  /// The activity type to tag each breadcrumb with.
  String currentActivityType;

  StreamSubscription<Position>? _positionSubscription;

  GpsTracker({
    required this.tripId,
    required this.onDwellDetected,
    this.currentActivityType = 'UNKNOWN',
  });

  /// Starts the GPS stream and begins recording breadcrumbs to Hive.
  ///
  /// The 50 m [distanceFilter] prevents redundant wake-ups when the device
  /// is stationary, which is the primary battery optimisation.
  void start() {
    final LocationSettings settings = _buildLocationSettings();

    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: settings,
    ).listen(_onPosition);
  }

  /// Halts the GPS stream. Call this when the trip ends or the activity
  /// switches to a non-tracking type.
  void stop() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /// Builds platform-specific [LocationSettings] to unlock foreground
  /// notification support on Android and optimised accuracy on iOS.
  LocationSettings _buildLocationSettings() {
    if (defaultTargetPlatform == TargetPlatform.android) {
      return AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: AppConfig.gpsDistanceFilterMetres,
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationText: 'PathSathi is recording your trip.',
          notificationTitle: 'Trip in progress',
          enableWakeLock: true,
        ),
      );
    } else if (defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: AppConfig.gpsDistanceFilterMetres,
        activityType: ActivityType.automotiveNavigation,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: true,
      );
    }
    return LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: AppConfig.gpsDistanceFilterMetres,
    );
  }

  Future<void> _onPosition(Position position) async {
    final breadcrumb = Breadcrumb(
      longitude: position.longitude,
      latitude: position.latitude,
      timestamp: position.timestamp,
      speed: position.speed,
      activityType: currentActivityType,
      tripId: tripId,
    );

    // Persist breadcrumb to Hive for offline buffering.
    final Box<Breadcrumb> box =
        Hive.box<Breadcrumb>(AppConfig.hiveBoxBreadcrumbs);
    await box.add(breadcrumb);

    _checkDwell(box);
  }

  /// Number of recent breadcrumbs used to evaluate dwell conditions.
  ///
  /// 5 samples at 50 m intervals = 200 m of travel data. This window is large
  /// enough to distinguish a brief stop at a red light from a genuine dwell,
  /// while remaining small enough to respond quickly when the user parks.
  static const int _dwellSampleSize = 5;

  void _checkDwell(Box<Breadcrumb> box) {
    // Only check once we have enough samples for this trip.
    final tripBreadcrumbs = box.values
        .where((b) => b.tripId == tripId)
        .toList()
      ..sort((a, b) => a.timestamp.compareTo(b.timestamp));

    if (tripBreadcrumbs.length < _dwellSampleSize) return;

    final recent =
        tripBreadcrumbs.sublist(tripBreadcrumbs.length - _dwellSampleSize);

    final Duration elapsed =
        recent.last.timestamp.difference(recent.first.timestamp);

    if (elapsed.inMinutes < AppConfig.dwellDurationMinutes) return;

    // Check that all recent points lie within the dwell radius.
    final double centLon =
        recent.map((b) => b.longitude).reduce((a, b) => a + b) /
            recent.length;
    final double centLat =
        recent.map((b) => b.latitude).reduce((a, b) => a + b) / recent.length;

    final bool allWithinRadius = recent.every((b) =>
        _haversineMetres(centLat, centLon, b.latitude, b.longitude) <=
        AppConfig.dwellRadiusMetres);

    if (allWithinRadius) {
      onDwellDetected();
    }
  }

  /// Haversine great-circle distance in metres between two lat/lon pairs.
  static double _haversineMetres(
      double lat1, double lon1, double lat2, double lon2) {
    const double r = 6371000; // Earth's mean radius in metres
    final double dLat = _toRad(lat2 - lat1);
    final double dLon = _toRad(lon2 - lon1);
    final double a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRad(lat1)) *
            cos(_toRad(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);
    return r * 2 * atan2(sqrt(a), sqrt(1 - a));
  }

  static double _toRad(double deg) => deg * pi / 180;
}

import 'dart:async';

import 'package:flutter_activity_recognition/flutter_activity_recognition.dart';
import 'package:uuid/uuid.dart';

import '../sensors/activity_recognition.dart';
import '../sensors/gps_tracker.dart';

/// Orchestrates the core state machine:
///
/// ```
/// Listener → Tracking → Dwell → Stop
/// ```
///
/// Listens to the [ActivityRecognitionService.activityStream] and starts or
/// stops [GpsTracker] depending on whether the detected activity warrants
/// GPS recording. When [GpsTracker] fires its dwell callback, the handler
/// finalises the trip and invokes [onTripCompleted].
class MotionHandler {
  /// Called when a trip is finalised (dwell detected or activity stopped).
  ///
  /// The [tripId] can be used by the caller to retrieve breadcrumbs from Hive
  /// and dispatch them via [SyncService].
  final void Function(String tripId) onTripCompleted;

  StreamSubscription<Activity>? _activitySubscription;
  GpsTracker? _gpsTracker;
  String? _currentTripId;
  String _currentActivityType = 'UNKNOWN';

  bool get isTracking => _gpsTracker != null;

  MotionHandler({required this.onTripCompleted});

  /// Begins listening to activity changes. Call once from the background
  /// service entry point.
  void startListening() {
    _activitySubscription =
        ActivityRecognitionService.activityStream.listen(_onActivity);
  }

  /// Stops all sensors and cleans up subscriptions.
  void stopListening() {
    _activitySubscription?.cancel();
    _activitySubscription = null;
    _stopTracking(finalisedByDwell: false);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  void _onActivity(Activity activity) {
    _currentActivityType =
        ActivityRecognitionService.activityTypeToString(activity.type);

    if (ActivityRecognitionService.isTrackingActivity(activity.type)) {
      _startTracking();
    } else {
      if (isTracking) {
        _stopTracking(finalisedByDwell: false);
      }
    }
  }

  void _startTracking() {
    if (isTracking) {
      // Already tracking; just update the activity label on new breadcrumbs.
      _gpsTracker!.currentActivityType = _currentActivityType;
      return;
    }

    _currentTripId = const Uuid().v4();

    _gpsTracker = GpsTracker(
      tripId: _currentTripId!,
      currentActivityType: _currentActivityType,
      onDwellDetected: _onDwellDetected,
    );
    _gpsTracker!.start();
  }

  void _stopTracking({required bool finalisedByDwell}) {
    _gpsTracker?.stop();
    _gpsTracker = null;

    if (_currentTripId != null && !finalisedByDwell) {
      // Non-dwell stop (activity changed to still/walking): treat as trip end.
      final tripId = _currentTripId!;
      _currentTripId = null;
      onTripCompleted(tripId);
    }
  }

  void _onDwellDetected() {
    final tripId = _currentTripId;
    _gpsTracker?.stop();
    _gpsTracker = null;
    _currentTripId = null;

    if (tripId != null) {
      onTripCompleted(tripId);
    }
  }
}

import 'package:flutter_activity_recognition/flutter_activity_recognition.dart';

/// Thin wrapper around [FlutterActivityRecognition] that exposes a typed
/// stream of activity changes and maps platform activity types to a canonical
/// string representation used throughout the app.
///
/// Battery impact: the Activity Recognition API delegates to the OS (Google
/// Fit on Android / Core Motion on iOS) which uses hardware step-counters and
/// barometers. CPU cost is negligible.
class ActivityRecognitionService {
  ActivityRecognitionService._();

  static final FlutterActivityRecognition _recognition =
      FlutterActivityRecognition.instance;

  /// Stream of recognised [Activity] objects.
  ///
  /// Subscribe to this stream to be notified whenever the user's movement
  /// type changes (e.g. WALKING → IN_VEHICLE).
  static Stream<Activity> get activityStream => _recognition.activityStream;

  /// Converts an [ActivityType] enum value to a human-readable string that
  /// matches the `activityType` field stored in [Breadcrumb] and sent to the
  /// backend.
  static String activityTypeToString(ActivityType type) {
    switch (type) {
      case ActivityType.IN_VEHICLE:
        return 'IN_VEHICLE';
      case ActivityType.ON_BICYCLE:
        return 'ON_BICYCLE';
      case ActivityType.RUNNING:
        return 'RUNNING';
      case ActivityType.WALKING:
        return 'WALKING';
      case ActivityType.STILL:
        return 'STILL';
      case ActivityType.TILTING:
        return 'TILTING';
      case ActivityType.UNKNOWN:
        return 'UNKNOWN';
      default:
        return 'UNKNOWN';
    }
  }

  /// Returns `true` when [type] represents active movement that should
  /// trigger GPS tracking.
  static bool isTrackingActivity(ActivityType type) {
    return type == ActivityType.IN_VEHICLE ||
        type == ActivityType.ON_BICYCLE ||
        type == ActivityType.RUNNING;
  }
}

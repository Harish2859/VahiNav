import 'package:permission_handler/permission_handler.dart';

/// Handles all runtime permission requests required by PathSathi.
///
/// Must be called early in the app lifecycle (e.g. from [main.dart]) so that
/// the background service can access location and activity data without being
/// interrupted by OS permission dialogs.
class PermissionService {
  PermissionService._();

  /// Requests all four permissions required for passive trip tracking:
  ///
  /// 1. **locationAlways** – GPS access in the background (critical).
  /// 2. **activityRecognition** – Physical activity detection via Google Fit /
  ///    Apple Health.
  /// 3. **notification** – Smart Nudge survey alerts (Android 13+ / iOS).
  /// 4. **ignoreBatteryOptimizations** – Prevents the OS from killing the
  ///    background service after ~10 minutes (Android only).
  ///
  /// Returns `true` only when all permissions have been granted. If any
  /// permission is permanently denied the user is directed to Settings via
  /// [openAppSettings].
  static Future<bool> requestAllPermissions() async {
    // Request the three standard permissions together to minimise dialog
    // interruptions for the user.
    final Map<Permission, PermissionStatus> statuses = await [
      Permission.locationAlways,
      Permission.activityRecognition,
      Permission.notification,
    ].request();

    // Battery optimisation must be requested separately on Android. On iOS
    // this permission does not exist, so the call is a no-op.
    final bool isBatteryOptimizationDisabled =
        await Permission.ignoreBatteryOptimizations.isGranted;
    if (!isBatteryOptimizationDisabled) {
      await Permission.ignoreBatteryOptimizations.request();
    }

    // Re-read the battery optimisation status after the request.
    final bool batteryGranted =
        await Permission.ignoreBatteryOptimizations.isGranted;

    final bool allStandardGranted =
        statuses.values.every((s) => s.isGranted);

    // Open app settings if any permission was permanently denied.
    if (!allStandardGranted) {
      final bool anyPermanentlyDenied =
          statuses.values.any((s) => s.isPermanentlyDenied);
      if (anyPermanentlyDenied) {
        await openAppSettings();
      }
    }

    return allStandardGranted && batteryGranted;
  }

  /// Returns whether all required permissions are currently granted without
  /// showing any dialogs. Useful for checking status on app resume.
  static Future<bool> allPermissionsGranted() async {
    final List<bool> results = await Future.wait([
      Permission.locationAlways.isGranted,
      Permission.activityRecognition.isGranted,
      Permission.notification.isGranted,
      Permission.ignoreBatteryOptimizations.isGranted,
    ]);
    return results.every((granted) => granted);
  }
}

import 'package:permission_handler/permission_handler.dart';
import 'package:flutter/foundation.dart';

class PermissionService {
  static Future<bool> requestAllPermissions() async {
    try {
      print('📍 Requesting permissions...');

      // Skip unsupported permissions on web
      PermissionStatus locationStatus = PermissionStatus.granted;
      PermissionStatus activityStatus = PermissionStatus.granted;
      
      if (!kIsWeb) {
        locationStatus = await Permission.locationAlways.request();
        print('Location: $locationStatus');

        activityStatus = await Permission.activityRecognition.request();
        print('Activity: $activityStatus');
      } else {
        print('⚠️ Location and Activity permissions not available on web');
      }

      final notificationStatus = await Permission.notification.request();
      print('Notification: $notificationStatus');

      bool allGranted = locationStatus.isGranted && activityStatus.isGranted && notificationStatus.isGranted;

      if (allGranted) {
        print('✅ Permissions granted');
      } else {
        print('⚠️ Some permissions denied');
      }

      return allGranted;
    } catch (e) {
      print('❌ Error: $e');
      return false;
    }
  }

  static Future<bool> isLocationPermissionGranted() async {
    final status = await Permission.locationAlways.status;
    return status.isGranted;
  }
}

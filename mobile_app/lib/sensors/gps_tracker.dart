import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../models/breadcrumb.dart';

class GPSTracker {
  static StreamSubscription<Position>? _positionStream;
  static late Box<dynamic> _breadcrumbBox;

  static Future<void> initialize() async {
    try {
      _breadcrumbBox = await Hive.openBox('breadcrumbs');
      print('✅ GPS Tracker initialized');
    } catch (e) {
      print('❌ Error: $e');
    }
  }

  static Future<void> startTracking() async {
    try {
      print('🚀 Starting GPS tracking');

      const locationSettings = LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 50,
        timeLimit: Duration(seconds: 10),
      );

      _positionStream = Geolocator.getPositionStream(
        locationSettings: locationSettings,
      ).listen((Position position) {
        _recordBreadcrumb(position);
      });

      print('✅ GPS tracking started');
    } catch (e) {
      print('❌ Error: $e');
    }
  }

  static Future<void> _recordBreadcrumb(Position position) async {
    try {
      final breadcrumb = Breadcrumb(
        longitude: position.longitude,
        latitude: position.latitude,
        speed: position.speed,
        timestamp: DateTime.now(),
        activityType: 'IN_VEHICLE',
      );

      await _breadcrumbBox.add(breadcrumb.toJson());
      print('📍 Breadcrumb: ${breadcrumb.latitude}, ${breadcrumb.longitude}');
    } catch (e) {
      print('❌ Error: $e');
    }
  }

  static Future<void> stopTracking() async {
    try {
      await _positionStream?.cancel();
      print('⏹️ GPS tracking stopped');
    } catch (e) {
      print('❌ Error: $e');
    }
  }

  static List<dynamic> getBufferedBreadcrumbs() {
    return _breadcrumbBox.values.toList();
  }

  static Future<void> clearBreadcrumbs() async {
    await _breadcrumbBox.clear();
    print('🗑️ Breadcrumbs cleared');
  }
}

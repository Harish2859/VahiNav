import 'package:hive/hive.dart';

part 'breadcrumb.g.dart';

/// A single GPS snapshot captured during an active trip.
///
/// Breadcrumbs are persisted to a Hive box so that they survive network
/// outages and app restarts. Once successfully synced to the backend they are
/// removed from local storage.
///
/// **Coordinate order:** longitude first, then latitude – matching the
/// PostGIS `ST_MakePoint(longitude, latitude)` convention used on the server.
@HiveType(typeId: 0)
class Breadcrumb extends HiveObject {
  /// Geographic longitude (−180 … 180).
  @HiveField(0)
  final double longitude;

  /// Geographic latitude (−90 … 90).
  @HiveField(1)
  final double latitude;

  /// UTC timestamp when this position was recorded.
  @HiveField(2)
  final DateTime timestamp;

  /// Speed in metres per second as reported by the GPS hardware.
  @HiveField(3)
  final double speed;

  /// Activity type recognised at the time of recording (e.g. `IN_VEHICLE`).
  @HiveField(4)
  final String activityType;

  /// The trip this breadcrumb belongs to.
  @HiveField(5)
  final String tripId;

  Breadcrumb({
    required this.longitude,
    required this.latitude,
    required this.timestamp,
    required this.speed,
    required this.activityType,
    required this.tripId,
  });

  /// Creates a [Breadcrumb] from a JSON map returned by or sent to the server.
  factory Breadcrumb.fromJson(Map<String, dynamic> json) {
    return Breadcrumb(
      longitude: (json['longitude'] as num).toDouble(),
      latitude: (json['latitude'] as num).toDouble(),
      timestamp: DateTime.parse(json['timestamp'] as String),
      speed: (json['speed'] as num).toDouble(),
      activityType: json['activityType'] as String,
      tripId: json['tripId'] as String,
    );
  }

  /// Serialises the breadcrumb to a JSON map for transmission to the backend.
  Map<String, dynamic> toJson() {
    return {
      'longitude': longitude,
      'latitude': latitude,
      'timestamp': timestamp.toUtc().toIso8601String(),
      'speed': speed,
      'activityType': activityType,
      'tripId': tripId,
    };
  }
}

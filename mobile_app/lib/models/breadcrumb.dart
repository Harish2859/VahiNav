class Breadcrumb {
  final double longitude;
  final double latitude;
  final double speed;
  final DateTime timestamp;
  final String? activityType;

  Breadcrumb({
    required this.longitude,
    required this.latitude,
    required this.speed,
    required this.timestamp,
    this.activityType,
  });

  Map<String, dynamic> toJson() => {
    'longitude': longitude,
    'latitude': latitude,
    'speed': speed,
    'timestamp': timestamp.toIso8601String(),
    'activity_type': activityType,
  };

  @override
  String toString() => 'Breadcrumb(\, \)';
}

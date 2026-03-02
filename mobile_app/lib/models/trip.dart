import 'breadcrumb.dart';

/// Represents a single travel event from start to finish.
///
/// A trip is the top-level container. It is created when movement is first
/// detected and finalised when dwell detection signals that the user has
/// arrived at a destination.
class Trip {
  /// Unique identifier (UUID v4).
  final String tripId;

  /// Backend user ID – populated from the authenticated session.
  final String userId;

  /// UTC timestamp when the trip started.
  final DateTime startTime;

  /// UTC timestamp when the trip ended (`null` while the trip is active).
  DateTime? endTime;

  /// Current lifecycle status of the trip.
  TripStatus status;

  /// Ordered list of GPS breadcrumbs recorded during the trip.
  final List<Breadcrumb> breadcrumbs;

  Trip({
    required this.tripId,
    required this.userId,
    required this.startTime,
    this.endTime,
    this.status = TripStatus.active,
    List<Breadcrumb>? breadcrumbs,
  }) : breadcrumbs = breadcrumbs ?? [];

  /// Creates a [Trip] from a JSON map.
  factory Trip.fromJson(Map<String, dynamic> json) {
    return Trip(
      tripId: json['tripId'] as String,
      userId: json['userId'] as String,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: json['endTime'] != null
          ? DateTime.parse(json['endTime'] as String)
          : null,
      status: TripStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => TripStatus.active,
      ),
      breadcrumbs: (json['breadcrumbs'] as List<dynamic>?)
              ?.map((b) => Breadcrumb.fromJson(b as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  /// Serialises the trip to JSON for transmission to the backend.
  Map<String, dynamic> toJson() {
    return {
      'tripId': tripId,
      'userId': userId,
      'startTime': startTime.toUtc().toIso8601String(),
      'endTime': endTime?.toUtc().toIso8601String(),
      'status': status.name,
      'breadcrumbs': breadcrumbs.map((b) => b.toJson()).toList(),
    };
  }
}

/// Lifecycle states of a [Trip].
enum TripStatus {
  /// GPS tracking active; breadcrumbs are being recorded.
  active,

  /// User has remained within the dwell radius; trip is being finalised.
  dwellDetected,

  /// Trip has been completed and is awaiting sync to the backend.
  completed,

  /// Trip data has been successfully synced to the backend.
  synced,
}

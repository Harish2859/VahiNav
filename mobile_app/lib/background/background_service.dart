import 'dart:ui';

import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../config/app_config.dart';
import '../models/breadcrumb.dart';
import '../services/motion_handler.dart';
import '../services/sync_service.dart';

/// Configures and starts the headless [FlutterBackgroundService].
///
/// **Battery optimisation strategy:**
/// - The background service runs as an Android foreground service with a
///   persistent notification, which prevents the OS from killing it.
/// - GPS is only activated when [MotionHandler] confirms an active-movement
///   activity (IN_VEHICLE, ON_BICYCLE, RUNNING), giving ~1-2 %/hour drain
///   instead of the 10 %+ that comes from constant-on GPS polling.
/// - [SyncService] uses Hive as an offline buffer, so no network calls are
///   made in dead zones – the background service never blocks on I/O.
class BackgroundServiceManager {
  BackgroundServiceManager._();

  /// Initialises and starts the background service.
  ///
  /// Must be called after [Hive.initFlutter()] and after Hive adapters have
  /// been registered.
  static Future<void> initialize() async {
    final service = FlutterBackgroundService();

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: _onStart,
        autoStart: true,
        isForegroundMode: true,
        notificationChannelId: 'path_sathi_tracking',
        initialNotificationTitle: 'PathSathi',
        initialNotificationContent: 'Waiting for movement…',
        foregroundServiceNotificationId: 888,
      ),
      iosConfiguration: IosConfiguration(
        autoStart: true,
        onForeground: _onStart,
        onBackground: _onIosBackground,
      ),
    );

    await service.startService();
  }
}

/// The headless entry point that runs even when the app UI has been
/// swiped away. Annotated with [@pragma] to prevent tree-shaking.
@pragma('vm:entry-point')
Future<void> _onStart(ServiceInstance service) async {
  // Ensure Flutter bindings are available in the background isolate.
  DartPluginRegistrant.ensureInitialized();

  // Initialise Hive in this isolate.
  await Hive.initFlutter();
  if (!Hive.isAdapterRegistered(0)) {
    Hive.registerAdapter(BreadcrumbAdapter());
  }
  await Hive.openBox<Breadcrumb>(AppConfig.hiveBoxBreadcrumbs);

  // ── State machine ────────────────────────────────────────────────────────
  // Listener Mode  →  Tracking Mode  →  Dwell Detection  →  Stop Mode
  // ─────────────────────────────────────────────────────────────────────────

  final syncService = SyncService()..startMonitoring();

  final motionHandler = MotionHandler(
    onTripCompleted: (String tripId) {
      // Stop Mode: breadcrumbs are already in Hive; trigger a sync attempt.
      syncService.sync();
    },
  );
  motionHandler.startListening();

  // Handle foreground ↔ background transitions.
  service.on('stop').listen((_) {
    motionHandler.stopListening();
    syncService.stopMonitoring();
    service.stopSelf();
  });

  service.on('update_notification').listen((event) {
    if (service is AndroidServiceInstance) {
      service.setForegroundNotificationInfo(
        title: event?['title'] as String? ?? 'PathSathi',
        content: event?['content'] as String? ?? '',
      );
    }
  });
}

/// iOS background fetch handler. Must return `true` to indicate that the
/// background work completed successfully.
@pragma('vm:entry-point')
Future<bool> _onIosBackground(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();
  return true;
}

import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:hive/hive.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/breadcrumb.dart';

/// Monitors network connectivity and syncs buffered breadcrumbs to the
/// Node.js backend whenever an internet connection is available.
///
/// **Offline resilience:**
/// When the device has no connectivity the breadcrumbs are already stored
/// in Hive by [GpsTracker]. [SyncService] simply waits for connectivity to
/// return, then sends the buffered data and clears the local store on success.
///
/// **Retry strategy:**
/// Uses exponential backoff up to [AppConfig.syncRetryMaxAttempts] retries.
/// After max retries the service waits for the next connectivity-change event
/// before trying again.
class SyncService {
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  bool _isSyncing = false;

  /// Starts monitoring connectivity changes. Call this from the background
  /// service entry point.
  void startMonitoring() {
    _connectivitySubscription = Connectivity()
        .onConnectivityChanged
        .listen(_onConnectivityChanged);

    // Attempt an immediate sync in case the device is already online.
    sync();
  }

  /// Manually triggers a sync attempt. Safe to call at any time; duplicate
  /// calls while a sync is in progress are silently ignored.
  Future<void> sync() => _attemptSync();

  /// Stops connectivity monitoring and cancels any pending subscriptions.
  void stopMonitoring() {
    _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  void _onConnectivityChanged(List<ConnectivityResult> results) {
    final bool online = results.any((r) => r != ConnectivityResult.none);
    if (online) {
      sync();
    }
  }

  /// Retrieves all unsynchronised breadcrumbs from Hive and POSTs them to the
  /// backend in a single batch. On success the Hive entries are deleted. On
  /// failure the entries are retained for the next attempt.
  Future<void> _attemptSync({int attempt = 0}) async {
    if (_isSyncing) return;
    _isSyncing = true;

    bool shouldRetry = false;

    try {
      final Box<Breadcrumb> box =
          Hive.box<Breadcrumb>(AppConfig.hiveBoxBreadcrumbs);

      if (box.isEmpty) return;

      final List<MapEntry<dynamic, Breadcrumb>> entries =
          box.toMap().entries.toList();

      final List<Map<String, dynamic>> payload =
          entries.map((e) => e.value.toJson()).toList();

      final response = await http
          .post(
            Uri.parse(AppConfig.tripsSyncUrl),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'breadcrumbs': payload}),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        // Clear synced entries.
        final List<dynamic> keys = entries.map((e) => e.key).toList();
        await box.deleteAll(keys);
      } else {
        shouldRetry = true;
      }
    } catch (_) {
      // Graceful degradation: never crash on network errors.
      shouldRetry = true;
    } finally {
      // Reset the flag before any retry so the recursive call is not blocked.
      _isSyncing = false;
    }

    if (shouldRetry) {
      await _scheduleRetry(attempt);
    }
  }

  /// Schedules a retry using exponential backoff. Stops retrying after
  /// [AppConfig.syncRetryMaxAttempts] attempts.
  Future<void> _scheduleRetry(int attempt) async {
    if (attempt >= AppConfig.syncRetryMaxAttempts) return;

    final int delaySeconds = AppConfig.syncRetryInitialDelaySeconds *
        (1 << attempt); // 5 s, 10 s, 20 s, 40 s, 80 s
    await Future.delayed(Duration(seconds: delaySeconds));
    await _attemptSync(attempt: attempt + 1);
  }
}

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'background/background_service.dart';
import 'config/app_config.dart';
import 'models/breadcrumb.dart';
import 'services/permission_service.dart';
import 'ui/smart_nudge_screen.dart';

/// FCM background message handler. Must be a top-level function.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background FCM messages are handled here. The SmartNudge UI is shown
  // when the user taps the notification (handled via onMessageOpenedApp).
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment configuration (.env asset).
  await dotenv.load(fileName: '.env');

  // Initialise Firebase (required before any Firebase service is used).
  await Firebase.initializeApp();

  // Initialise Hive offline storage.
  await Hive.initFlutter();
  Hive.registerAdapter(BreadcrumbAdapter());
  await Hive.openBox<Breadcrumb>(AppConfig.hiveBoxBreadcrumbs);

  // Initialise Firebase Messaging and register background handler.
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  // Start the headless background service.
  await BackgroundServiceManager.initialize();

  runApp(const PathSathiApp());
}

/// Root widget for the PathSathi application.
class PathSathiApp extends StatelessWidget {
  const PathSathiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PathSathi',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      home: const _HomeScreen(),
    );
  }
}

class _HomeScreen extends StatefulWidget {
  const _HomeScreen();

  @override
  State<_HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<_HomeScreen> {
  bool _permissionsGranted = false;
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    _initPermissions();
    _setupFcm();
  }

  Future<void> _initPermissions() async {
    final granted = await PermissionService.requestAllPermissions();
    if (mounted) {
      setState(() {
        _permissionsGranted = granted;
        _checking = false;
      });
    }
  }

  void _setupFcm() {
    // Handle FCM nudge when app is opened from a notification.
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      final tripId = message.data['tripId'] as String?;
      if (tripId != null && mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => SmartNudgeScreen(tripId: tripId),
          ),
        );
      }
    });

    // Handle FCM nudge while app is in foreground.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setupFcmNudgeHandler(context);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('PathSathi')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                _permissionsGranted
                    ? Icons.check_circle_outline
                    : Icons.warning_amber_rounded,
                size: 72,
                color: _permissionsGranted ? Colors.green : Colors.orange,
              ),
              const SizedBox(height: 16),
              Text(
                _permissionsGranted
                    ? 'PathSathi is running in the background.\n'
                        'Your trips are being tracked automatically.'
                    : 'Some permissions are missing.\n'
                        'Please grant all permissions for full functionality.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 24),
              if (!_permissionsGranted)
                ElevatedButton.icon(
                  onPressed: _initPermissions,
                  icon: const Icon(Icons.security),
                  label: const Text('Grant Permissions'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

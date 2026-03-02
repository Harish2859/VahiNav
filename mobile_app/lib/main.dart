import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'services/permission_service.dart';
import 'sensors/gps_tracker.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Hive.initFlutter();

  // Always initialize GPS tracker (at least the Hive box)
  await GPSTracker.initialize();

  final permissionsGranted = await PermissionService.requestAllPermissions();

  if (permissionsGranted) {
    print('✅ App initialization complete');
  } else {
    print('⚠️ Permissions not fully granted');
  }

  runApp(const VahiNavApp());
}

class VahiNavApp extends StatelessWidget {
  const VahiNavApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VahiNav',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const HomePage(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({Key? key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _isTracking = false;
  int _breadcrumbCount = 0;

  @override
  void initState() {
    super.initState();
    _updateBreadcrumbCount();
  }

  void _updateBreadcrumbCount() {
    setState(() {
      _breadcrumbCount = GPSTracker.getBufferedBreadcrumbs().length;
    });
  }

  Future<void> _toggleTracking() async {
    try {
      if (_isTracking) {
        await GPSTracker.stopTracking();
        setState(() => _isTracking = false);
        _showSnackBar('Tracking stopped', Colors.orange);
      } else {
        await GPSTracker.startTracking();
        setState(() => _isTracking = true);
        _showSnackBar('Tracking started 🚀', Colors.green);
      }
      _updateBreadcrumbCount();
    } catch (e) {
      _showSnackBar('Error: $e', Colors.red);
    }
  }

  Future<void> _clearBreadcrumbs() async {
    try {
      await GPSTracker.clearBreadcrumbs();
      _updateBreadcrumbCount();
      _showSnackBar('Breadcrumbs cleared', Colors.blue);
    } catch (e) {
      _showSnackBar('Error: $e', Colors.red);
    }
  }

  void _showSnackBar(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🛰️ VahiNav - Trip Tracker'),
        centerTitle: true,
        elevation: 0,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _isTracking ? Colors.green.shade100 : Colors.grey.shade100,
              ),
              child: Icon(
                _isTracking ? Icons.location_on : Icons.location_off,
                size: 80,
                color: _isTracking ? Colors.green : Colors.grey,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              _isTracking ? 'Tracking Active 📡' : 'Tracking Inactive',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: _isTracking ? Colors.green : Colors.grey,
                  ),
            ),
            const SizedBox(height: 30),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 15),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.blue),
              ),
              child: Column(
                children: [
                  const Text('📍 Buffered Breadcrumbs'),
                  Text(
                    '$_breadcrumbCount',
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.blue,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 40),
            ElevatedButton.icon(
              onPressed: _toggleTracking,
              icon: Icon(_isTracking ? Icons.stop_circle : Icons.play_circle),
              label: Text(_isTracking ? 'Stop Tracking' : 'Start Tracking'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 15),
                backgroundColor: _isTracking ? Colors.red : Colors.green,
                foregroundColor: Colors.white,
              ),
            ),
            const SizedBox(height: 15),
            OutlinedButton.icon(
              onPressed: _clearBreadcrumbs,
              icon: const Icon(Icons.delete),
              label: const Text('Clear Buffer'),
            ),
            const SizedBox(height: 40),
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 20),
              child: Padding(
                padding: const EdgeInsets.all(15),
                child: Column(
                  children: const [
                    Text('Backend Status', style: TextStyle(fontWeight: FontWeight.bold)),
                    SizedBox(height: 5),
                    // If you need a literal backslash, use '\\' or r'\'
                    Text('🌐 http://localhost:8000', style: TextStyle(fontSize: 12)),
                    SizedBox(height: 10),
                    Text(
                      'Ready to sync 🔄',
                      style: TextStyle(fontSize: 12, color: Colors.green),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
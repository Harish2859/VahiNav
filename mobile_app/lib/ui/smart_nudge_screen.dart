import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';

/// The "Smart Nudge" survey screen.
///
/// This screen is presented to the user after a trip is completed. It is
/// triggered by an FCM push notification sent by the Node.js backend once it
/// detects that a trip has ended.
///
/// The user is asked three quick questions:
///   1. Trip purpose (e.g. Work, Shopping, Education)
///   2. Estimated cost of the trip (₹)
///   3. Number of travel companions (including the user)
///
/// Survey responses are sent to the backend in a single POST request.
class SmartNudgeScreen extends StatefulWidget {
  /// The trip ID that this survey is associated with.
  final String tripId;

  const SmartNudgeScreen({super.key, required this.tripId});

  @override
  State<SmartNudgeScreen> createState() => _SmartNudgeScreenState();
}

class _SmartNudgeScreenState extends State<SmartNudgeScreen> {
  final _formKey = GlobalKey<FormState>();

  String? _purpose;
  final TextEditingController _costController = TextEditingController();
  final TextEditingController _companionsController = TextEditingController();

  bool _isSubmitting = false;
  String? _errorMessage;

  static const List<String> _purposeOptions = [
    'Work / Office',
    'Education',
    'Shopping',
    'Healthcare',
    'Recreation / Leisure',
    'Home',
    'Other',
  ];

  @override
  void dispose() {
    _costController.dispose();
    _companionsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final response = await http
          .post(
            Uri.parse('${AppConfig.backendBaseUrl}/api/v1/surveys'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'tripId': widget.tripId,
              'purpose': _purpose,
              'estimatedCostInr': double.parse(_costController.text),
              'companions': int.parse(_companionsController.text),
            }),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (mounted) {
          Navigator.of(context).pop(true);
        }
      } else {
        setState(() {
          _errorMessage =
              'Failed to submit survey (${response.statusCode}). Please try again.';
        });
      }
    } catch (_) {
      setState(() {
        _errorMessage = 'Network error. Please check your connection.';
      });
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Quick Trip Survey')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                '🚗 You completed a trip! Help us improve transport planning '
                'by answering 3 quick questions.',
                style: TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 24),

              // Purpose dropdown
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(
                  labelText: 'Trip Purpose',
                  border: OutlineInputBorder(),
                ),
                value: _purpose,
                items: _purposeOptions
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (v) => setState(() => _purpose = v),
                validator: (v) =>
                    v == null ? 'Please select a trip purpose.' : null,
              ),
              const SizedBox(height: 16),

              // Cost field
              TextFormField(
                controller: _costController,
                decoration: const InputDecoration(
                  labelText: 'Estimated Cost (₹)',
                  border: OutlineInputBorder(),
                  prefixText: '₹ ',
                ),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Please enter cost.';
                  if (double.tryParse(v) == null) return 'Enter a valid number.';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Companions field
              TextFormField(
                controller: _companionsController,
                decoration: const InputDecoration(
                  labelText: 'Number of Travellers (incl. you)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Please enter a number.';
                  final n = int.tryParse(v);
                  if (n == null || n < 1) return 'Must be at least 1.';
                  return null;
                },
              ),
              const SizedBox(height: 24),

              if (_errorMessage != null) ...[
                Text(
                  _errorMessage!,
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
              ],

              ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Submit Survey'),
              ),

              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Skip'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Configures the FCM message handler that opens [SmartNudgeScreen] when a
/// "trip_completed" notification is received while the app is in the
/// foreground.
///
/// Call this once from [main.dart] after Firebase has been initialised.
void setupFcmNudgeHandler(BuildContext context) {
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    final data = message.data;
    if (data['type'] == 'trip_completed') {
      final tripId = data['tripId'] as String?;
      if (tripId != null && context.mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => SmartNudgeScreen(tripId: tripId),
          ),
        );
      }
    }
  });
}

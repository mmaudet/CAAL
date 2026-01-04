import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../controllers/app_ctrl.dart';
import '../l10n/app_localizations.dart';

/// Settings modal that fetches and saves settings from the server API.
/// Only available during an active session (webhook server must be running).
class SettingsModal extends StatefulWidget {
  final ScrollController? scrollController;

  const SettingsModal({super.key, this.scrollController});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1A1A1A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => SettingsModal(
          scrollController: scrollController,
        ),
      ),
    );
  }

  @override
  State<SettingsModal> createState() => _SettingsModalState();
}

class _SettingsModalState extends State<SettingsModal> {
  bool _loading = true;
  bool _saving = false;
  String? _error;

  // Settings fields
  String _agentName = 'Cal';
  String _ttsVoice = 'am_puck';
  String _model = 'ministral-3:8b';
  List<String> _wakeGreetings = ["Hey, what's up?", "What's up?", 'How can I help?'];
  List<String> _wakeGreetingsFr = ['Oui?', "Je t'ecoute!", "Comment puis-je t'aider?"];
  double _temperature = 0.7;
  int _numCtx = 8192;
  int _maxTurns = 20;
  int _toolCacheSize = 3;
  bool _wakeWordEnabled = false;
  String _wakeWordModel = 'models/hey_cal.onnx';
  double _wakeWordThreshold = 0.5;
  double _wakeWordTimeout = 3.0;
  String _language = 'en';
  String _sttLanguage = 'auto';

  // Confirmation and countdown states
  bool _showDisconnectConfirm = false;
  bool _showCountdown = false;
  int _countdownSeconds = 10;

  // Available options - voices stored as objects with {id, language, name}
  List<Map<String, dynamic>> _voiceObjects = [];
  List<String> _models = [];
  List<String> _wakeWordModels = [];

  // Text controllers
  final _wakeGreetingsController = TextEditingController();
  final _wakeGreetingsFrController = TextEditingController();

  String get _webhookUrl {
    final serverUrl = context.read<AppCtrl>().serverUrl;
    final uri = Uri.parse(serverUrl);
    return 'http://${uri.host}:8889';
  }

  @override
  void initState() {
    super.initState();
    unawaited(_loadSettings());
  }

  @override
  void dispose() {
    _wakeGreetingsController.dispose();
    _wakeGreetingsFrController.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        http.get(Uri.parse('$_webhookUrl/settings')),
        http.get(Uri.parse('$_webhookUrl/voices')),
        http.get(Uri.parse('$_webhookUrl/models')),
        http.get(Uri.parse('$_webhookUrl/wake-word/models')),
      ]);

      final settingsRes = results[0];
      final voicesRes = results[1];
      final modelsRes = results[2];
      final wakeWordModelsRes = results[3];

      if (settingsRes.statusCode == 200) {
        final data = jsonDecode(settingsRes.body);
        final settings = data['settings'] ?? {};

        setState(() {
          _agentName = settings['agent_name'] ?? _agentName;
          _ttsVoice = settings['tts_voice'] ?? _ttsVoice;
          _model = settings['model'] ?? _model;
          _wakeGreetings = List<String>.from(settings['wake_greetings'] ?? _wakeGreetings);
          _wakeGreetingsFr = List<String>.from(settings['wake_greetings_fr'] ?? _wakeGreetingsFr);
          _temperature = (settings['temperature'] ?? _temperature).toDouble();
          _numCtx = settings['num_ctx'] ?? _numCtx;
          _maxTurns = settings['max_turns'] ?? _maxTurns;
          _toolCacheSize = settings['tool_cache_size'] ?? _toolCacheSize;
          _wakeWordEnabled = settings['wake_word_enabled'] ?? _wakeWordEnabled;
          _wakeWordModel = settings['wake_word_model'] ?? _wakeWordModel;
          _wakeWordThreshold = (settings['wake_word_threshold'] ?? _wakeWordThreshold).toDouble();
          _wakeWordTimeout = (settings['wake_word_timeout'] ?? _wakeWordTimeout).toDouble();
          _language = settings['language'] ?? _language;
          _sttLanguage = settings['stt_language'] ?? _sttLanguage;
          _wakeGreetingsController.text = _wakeGreetings.join('\n');
          _wakeGreetingsFrController.text = _wakeGreetingsFr.join('\n');
        });
      }

      if (voicesRes.statusCode == 200) {
        final data = jsonDecode(voicesRes.body);
        final voiceList = data['voices'] as List? ?? [];
        setState(() {
          // Backend returns objects with {id, language, name}, store full objects
          _voiceObjects = voiceList
              .map((v) => v is Map<String, dynamic>
                  ? v
                  : {'id': v.toString(), 'language': 'en', 'name': v.toString()})
              .toList();
        });
      }

      if (modelsRes.statusCode == 200) {
        final data = jsonDecode(modelsRes.body);
        final modelList = data['models'] as List? ?? [];
        setState(() {
          // Backend returns objects with {id, name}, extract id
          _models = modelList.map((m) => m is Map ? m['id'] as String : m as String).toList();
        });
      }

      if (wakeWordModelsRes.statusCode == 200) {
        final data = jsonDecode(wakeWordModelsRes.body);
        final wakeWordModelList = data['models'] as List? ?? [];
        setState(() {
          // Wake word models are returned as strings (paths like "models/hey_cal.onnx")
          _wakeWordModels = wakeWordModelList.map((m) => m is Map ? m['id'] as String : m as String).toList();
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to load settings: $e';
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  void _showSaveConfirmation() {
    setState(() {
      _showDisconnectConfirm = true;
    });
  }

  void _cancelSave() {
    setState(() {
      _showDisconnectConfirm = false;
    });
    Navigator.of(context).pop(); // Close settings and return to agent
  }

  Future<void> _confirmSave() async {
    setState(() {
      _saving = true;
      _error = null;
      _showDisconnectConfirm = false;
    });

    try {
      // Parse wake greetings from text
      final greetings =
          _wakeGreetingsController.text.split('\n').where((g) => g.trim().isNotEmpty).toList();
      final greetingsFr =
          _wakeGreetingsFrController.text.split('\n').where((g) => g.trim().isNotEmpty).toList();

      final settings = {
        'agent_name': _agentName,
        'tts_voice': _ttsVoice,
        'model': _model,
        'wake_greetings': greetings,
        'wake_greetings_fr': greetingsFr,
        'temperature': _temperature,
        'num_ctx': _numCtx,
        'max_turns': _maxTurns,
        'tool_cache_size': _toolCacheSize,
        'wake_word_enabled': _wakeWordEnabled,
        'wake_word_model': _wakeWordModel,
        'wake_word_threshold': _wakeWordThreshold,
        'wake_word_timeout': _wakeWordTimeout,
        'language': _language,
        'stt_language': _sttLanguage,
      };

      final res = await http.post(
        Uri.parse('$_webhookUrl/settings'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'settings': settings}),
      );

      if (res.statusCode == 200) {
        // Show countdown before disconnecting
        setState(() {
          _saving = false;
          _showCountdown = true;
          _countdownSeconds = 10;
        });

        // Pre-warm services during countdown
        unawaited(http.post(Uri.parse('$_webhookUrl/warmup')).catchError((_) => http.Response('', 500)));

        // Countdown
        for (int i = 10; i >= 0; i--) {
          if (!mounted) return;
          setState(() => _countdownSeconds = i);
          if (i > 0) {
            await Future.delayed(const Duration(seconds: 1));
          }
        }

        // Disconnect, reset session, wait for agent restart, then reconnect
        if (mounted) {
          final appCtrl = context.read<AppCtrl>();
          final l10n = context.read<AppLocalizations>();

          // Sync Flutter app locale with backend language setting
          await l10n.setLocale(Locale(_language));

          Navigator.of(context).pop();

          // Disconnect and reset session to force new token/room
          await appCtrl.disconnectAndReset();

          // Wait for the backend agent to be ready for new room
          await Future.delayed(const Duration(seconds: 5));

          // Auto-reconnect with fresh session
          appCtrl.connect();
        }
      } else {
        setState(() {
          _error = 'Failed to save settings: ${res.statusCode}';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to save settings: $e';
        _showCountdown = false;
      });
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.watch<AppLocalizations>();

    return Stack(
      children: [
        Column(
          children: [
        // Header
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.settings, color: Color(0xFF45997C), size: 20),
                  const SizedBox(width: 10),
                  Text(
                    l10n.t('settings.title'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),

        // Content
        Expanded(
          child: _loading
              ? const Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFF45997C),
                  ),
                )
              : ListView(
                  controller: widget.scrollController,
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_error != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _error!,
                          style: const TextStyle(color: Colors.red),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Language Selection
                    _buildLabel(l10n.t('settings.language')),
                    Row(
                      children: [
                        Expanded(
                          child: _buildLanguageButton(
                            label: 'English',
                            isSelected: _language == 'en',
                            onTap: () => _selectLanguage('en'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildLanguageButton(
                            label: 'Français',
                            isSelected: _language == 'fr',
                            onTap: () => _selectLanguage('fr'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      l10n.t('settings.languageHint'),
                      style: const TextStyle(color: Colors.white38, fontSize: 12),
                    ),
                    const SizedBox(height: 16),

                    // STT Language Hint
                    _buildLabel(l10n.t('settings.sttLanguage')),
                    _buildSttLanguageDropdown(),
                    const SizedBox(height: 4),
                    Text(
                      l10n.t('settings.sttLanguageHint'),
                      style: const TextStyle(color: Colors.white38, fontSize: 12),
                    ),
                    const SizedBox(height: 16),

                    // Agent Name
                    _buildTextField(
                      label: l10n.t('settings.agentName'),
                      value: _agentName,
                      onChanged: (v) => setState(() => _agentName = v),
                    ),

                    // Voice (filtered by language)
                    _buildVoiceDropdown(l10n),

                    // Model
                    _buildDropdown(
                      label: l10n.t('settings.model'),
                      value: _model,
                      options: _models.isNotEmpty ? _models : [_model],
                      onChanged: (v) => setState(() => _model = v ?? _model),
                    ),

                    // Wake Greetings (based on selected language)
                    _buildLabel('${l10n.t('settings.wakeGreetings')} (${_language == 'fr' ? 'Français' : 'English'})'),
                    TextFormField(
                      controller: _language == 'fr' ? _wakeGreetingsFrController : _wakeGreetingsController,
                      maxLines: 4,
                      style: const TextStyle(color: Colors.white),
                      decoration: _inputDecoration(
                        hint: _language == 'fr' ? "Oui?\nJe t'ecoute!" : "Hey, what's up?\nWhat's up?",
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Numeric settings row 1
                    Row(
                      children: [
                        Expanded(
                          child: _buildNumberField(
                            label: l10n.t('settings.temperature'),
                            value: _temperature,
                            min: 0.0,
                            max: 2.0,
                            decimals: 1,
                            onChanged: (v) => setState(() => _temperature = v),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildIntField(
                            label: l10n.t('settings.contextSize'),
                            value: _numCtx,
                            min: 1024,
                            max: 131072,
                            step: 1024,
                            onChanged: (v) => setState(() => _numCtx = v),
                          ),
                        ),
                      ],
                    ),

                    // Numeric settings row 2
                    Row(
                      children: [
                        Expanded(
                          child: _buildIntField(
                            label: l10n.t('settings.maxTurns'),
                            value: _maxTurns,
                            min: 1,
                            max: 100,
                            onChanged: (v) => setState(() => _maxTurns = v),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildIntField(
                            label: l10n.t('settings.toolCache'),
                            value: _toolCacheSize,
                            min: 0,
                            max: 10,
                            onChanged: (v) => setState(() => _toolCacheSize = v),
                          ),
                        ),
                      ],
                    ),

                    // Wake Word Section
                    Container(
                      margin: const EdgeInsets.only(top: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    l10n.t('settings.wakeWord'),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  Text(
                                    l10n.t('settings.wakeWordHint'),
                                    style: const TextStyle(
                                      color: Colors.white54,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                              Switch(
                                value: _wakeWordEnabled,
                                onChanged: (v) => setState(() => _wakeWordEnabled = v),
                                activeTrackColor: const Color(0xFF45997C),
                              ),
                            ],
                          ),
                          if (_wakeWordEnabled) ...[
                            const SizedBox(height: 12),
                            // Wake Word Model Dropdown
                            _buildWakeWordModelDropdown(l10n),
                            Row(
                              children: [
                                Expanded(
                                  child: _buildNumberField(
                                    label: l10n.t('settings.threshold'),
                                    value: _wakeWordThreshold,
                                    min: 0.1,
                                    max: 1.0,
                                    decimals: 1,
                                    onChanged: (v) => setState(() => _wakeWordThreshold = v),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _buildNumberField(
                                    label: l10n.t('settings.timeout'),
                                    value: _wakeWordTimeout,
                                    min: 1.0,
                                    max: 30.0,
                                    decimals: 1,
                                    onChanged: (v) => setState(() => _wakeWordTimeout = v),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),

                    const SizedBox(height: 8),
                    Text(
                      l10n.t('settings.modelNote'),
                      style: const TextStyle(color: Colors.white38, fontSize: 12),
                    ),
                  ],
                ),
        ),

        // Footer
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: _saving || _showCountdown ? null : () => Navigator.of(context).pop(),
                child: Text(l10n.t('settings.cancel'), style: const TextStyle(color: Colors.white70)),
              ),
              const SizedBox(width: 12),
              TextButton(
                onPressed: _loading || _saving || _showCountdown ? null : _showSaveConfirmation,
                style: TextButton.styleFrom(
                  backgroundColor: const Color(0xFF45997C),
                  foregroundColor: const Color(0xFF171717),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation(Color(0xFF171717)),
                          ),
                        )
                      : Text(l10n.t('settings.save'), style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
          ],
        ),

        // Disconnect Confirmation Dialog
        if (_showDisconnectConfirm)
          Positioned.fill(
            child: Container(
              color: const Color(0xFF1A1A1A).withValues(alpha: 0.95),
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        l10n.t('settings.disconnectConfirmTitle'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        l10n.t('settings.disconnectConfirmMessage'),
                        style: const TextStyle(color: Colors.white70, fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          TextButton(
                            onPressed: _cancelSave,
                            child: Text(l10n.t('settings.no'), style: const TextStyle(color: Colors.white70)),
                          ),
                          const SizedBox(width: 16),
                          TextButton(
                            onPressed: _saving ? null : _confirmSave,
                            style: TextButton.styleFrom(
                              backgroundColor: Colors.red,
                              foregroundColor: Colors.white,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Text(l10n.t('settings.yes')),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

        // Countdown Display
        if (_showCountdown)
          Positioned.fill(
            child: Container(
              color: const Color(0xFF1A1A1A).withValues(alpha: 0.95),
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$_countdownSeconds',
                        style: const TextStyle(
                          color: Color(0xFF45997C),
                          fontSize: 64,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        l10n.t('settings.restarting'),
                        style: const TextStyle(color: Colors.white70, fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: 200,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: (10 - _countdownSeconds) / 10,
                            backgroundColor: Colors.white24,
                            valueColor: const AlwaysStoppedAnimation(Color(0xFF45997C)),
                            minHeight: 8,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  InputDecoration _inputDecoration({String? hint}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Colors.white38),
      filled: true,
      fillColor: const Color(0xFF2A2A2A),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    );
  }

  Widget _buildTextField({
    required String label,
    required String value,
    required ValueChanged<String> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel(label),
        TextFormField(
          initialValue: value,
          style: const TextStyle(color: Colors.white),
          decoration: _inputDecoration(),
          onChanged: onChanged,
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildDropdown({
    required String label,
    required String value,
    required List<String> options,
    required ValueChanged<String?> onChanged,
  }) {
    // Ensure value is in options
    final safeValue = options.contains(value) ? value : (options.isNotEmpty ? options.first : value);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel(label),
        DropdownButtonFormField<String>(
          initialValue: safeValue,
          style: const TextStyle(color: Colors.white),
          dropdownColor: const Color(0xFF2A2A2A),
          decoration: _inputDecoration(),
          items: options.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
          onChanged: onChanged,
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildNumberField({
    required String label,
    required double value,
    required double min,
    required double max,
    required int decimals,
    required ValueChanged<double> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel(label),
        TextFormField(
          initialValue: value.toStringAsFixed(decimals),
          style: const TextStyle(color: Colors.white),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: _inputDecoration(),
          onChanged: (v) {
            final parsed = double.tryParse(v);
            if (parsed != null && parsed >= min && parsed <= max) {
              onChanged(parsed);
            }
          },
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildIntField({
    required String label,
    required int value,
    required int min,
    required int max,
    int step = 1,
    required ValueChanged<int> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel(label),
        TextFormField(
          initialValue: value.toString(),
          style: const TextStyle(color: Colors.white),
          keyboardType: TextInputType.number,
          decoration: _inputDecoration(),
          onChanged: (v) {
            final parsed = int.tryParse(v);
            if (parsed != null && parsed >= min && parsed <= max) {
              onChanged(parsed);
            }
          },
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  /// Format model path for display: "models/hey_cal.onnx" -> "Hey Cal"
  String _formatModelName(String path) {
    return path
        .replaceAll('models/', '')
        .replaceAll('.onnx', '')
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
        .join(' ');
  }

  Widget _buildWakeWordModelDropdown(AppLocalizations l10n) {
    final options = _wakeWordModels.isNotEmpty ? _wakeWordModels : [_wakeWordModel];
    final safeValue = options.contains(_wakeWordModel) ? _wakeWordModel : options.first;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.t('settings.wakeWordModel'),
          style: const TextStyle(color: Colors.white54, fontSize: 12),
        ),
        const SizedBox(height: 4),
        DropdownButtonFormField<String>(
          initialValue: safeValue,
          style: const TextStyle(color: Colors.white),
          dropdownColor: const Color(0xFF2A2A2A),
          decoration: _inputDecoration(),
          items: options
              .map((m) => DropdownMenuItem(
                    value: m,
                    child: Text(_formatModelName(m)),
                  ))
              .toList(),
          onChanged: (v) => setState(() => _wakeWordModel = v ?? _wakeWordModel),
        ),
        const SizedBox(height: 12),
      ],
    );
  }

  Widget _buildLanguageButton({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF45997C) : const Color(0xFF2A2A2A),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? const Color(0xFF171717) : Colors.white,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }

  void _selectLanguage(String lang) {
    if (lang == _language) return;

    // Find a voice in the new language
    final voicesInNewLang = _voiceObjects.where((v) => v['language'] == lang).toList();
    final currentVoiceInNewLang = voicesInNewLang.firstWhere(
      (v) => v['id'] == _ttsVoice,
      orElse: () => voicesInNewLang.isNotEmpty
          ? voicesInNewLang.first
          : {'id': lang == 'fr' ? 'fr_FR-siwis-medium' : 'am_puck'},
    );

    setState(() {
      _language = lang;
      _ttsVoice = currentVoiceInNewLang['id'] as String;
    });
  }

  Widget _buildSttLanguageDropdown() {
    return DropdownButtonFormField<String>(
      initialValue: _sttLanguage,
      style: const TextStyle(color: Colors.white),
      dropdownColor: const Color(0xFF2A2A2A),
      decoration: _inputDecoration(),
      items: const [
        DropdownMenuItem(value: 'auto', child: Text('Auto-detect')),
        DropdownMenuItem(value: 'en', child: Text('English only')),
        DropdownMenuItem(value: 'fr', child: Text('French only')),
      ],
      onChanged: (v) => setState(() => _sttLanguage = v ?? 'auto'),
    );
  }

  Widget _buildVoiceDropdown(AppLocalizations l10n) {
    // Filter voices by selected language
    final filteredVoices = _voiceObjects.where((v) => v['language'] == _language).toList();

    // Build options list
    final options = filteredVoices.isNotEmpty
        ? filteredVoices.map((v) => v['id'] as String).toList()
        : [_ttsVoice];

    // Ensure current voice is in options
    final safeValue = options.contains(_ttsVoice) ? _ttsVoice : (options.isNotEmpty ? options.first : _ttsVoice);

    // Get display names
    String getVoiceName(String id) {
      final voice = _voiceObjects.firstWhere(
        (v) => v['id'] == id,
        orElse: () => {'id': id, 'name': id},
      );
      return (voice['name'] as String?) ?? id;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel(l10n.t('settings.voice')),
        DropdownButtonFormField<String>(
          initialValue: safeValue,
          style: const TextStyle(color: Colors.white),
          dropdownColor: const Color(0xFF2A2A2A),
          decoration: _inputDecoration(),
          items: options
              .map((id) => DropdownMenuItem(
                    value: id,
                    child: Text(getVoiceName(id)),
                  ))
              .toList(),
          onChanged: (v) => setState(() => _ttsVoice = v ?? _ttsVoice),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

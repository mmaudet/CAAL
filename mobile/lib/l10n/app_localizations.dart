import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// App-wide localization provider using JSON files.
/// Supports English and French with dynamic switching.
class AppLocalizations extends ChangeNotifier {
  static const String _localeKey = 'app_locale';
  static const List<Locale> supportedLocales = [
    Locale('en'),
    Locale('fr'),
  ];

  Locale _locale;
  Map<String, dynamic> _messages = {};
  bool _loaded = false;

  AppLocalizations([Locale? initialLocale]) : _locale = initialLocale ?? const Locale('en');

  Locale get locale => _locale;
  bool get isLoaded => _loaded;

  /// Load messages for the current locale.
  Future<void> load() async {
    try {
      final jsonString = await rootBundle.loadString('l10n/${_locale.languageCode}.json');
      _messages = jsonDecode(jsonString) as Map<String, dynamic>;
      _loaded = true;
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to load locale ${_locale.languageCode}: $e');
      // Fallback to English if loading fails
      if (_locale.languageCode != 'en') {
        _locale = const Locale('en');
        await load();
      }
    }
  }

  /// Change the current locale and reload messages.
  Future<void> setLocale(Locale newLocale) async {
    if (!supportedLocales.contains(newLocale)) {
      debugPrint('Unsupported locale: $newLocale');
      return;
    }

    if (_locale == newLocale) return;

    _locale = newLocale;

    // Persist locale preference
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_localeKey, newLocale.languageCode);
    } catch (e) {
      debugPrint('Failed to save locale preference: $e');
    }

    await load();
  }

  /// Load saved locale preference.
  static Future<Locale> getSavedLocale() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedCode = prefs.getString(_localeKey);
      if (savedCode != null) {
        final locale = Locale(savedCode);
        if (supportedLocales.contains(locale)) {
          return locale;
        }
      }
    } catch (e) {
      debugPrint('Failed to load saved locale: $e');
    }
    return const Locale('en');
  }

  /// Translate a key with optional parameters.
  /// Supports nested keys like 'welcome.title'.
  String t(String key, [Map<String, String>? params]) {
    final keys = key.split('.');
    dynamic value = _messages;

    for (final k in keys) {
      if (value is Map<String, dynamic> && value.containsKey(k)) {
        value = value[k];
      } else {
        return key; // Key not found, return the key itself
      }
    }

    if (value is! String) return key;

    // Replace parameters like {name}
    if (params != null) {
      var result = value;
      params.forEach((k, v) {
        result = result.replaceAll('{$k}', v);
      });
      return result;
    }

    return value;
  }
}

/// Extension to easily access AppLocalizations from BuildContext.
extension AppLocalizationsExtension on BuildContext {
  AppLocalizations get l10n {
    // Use Provider or InheritedWidget to access AppLocalizations
    // This is a placeholder - actual implementation depends on state management
    throw UnimplementedError('Use Provider to access AppLocalizations');
  }
}

/// Flag data for language selector.
class LocaleFlag {
  final Locale locale;
  final String flag;
  final String name;

  const LocaleFlag({
    required this.locale,
    required this.flag,
    required this.name,
  });
}

const availableLocales = [
  LocaleFlag(locale: Locale('en'), flag: '\u{1F1EC}\u{1F1E7}', name: 'English'),
  LocaleFlag(locale: Locale('fr'), flag: '\u{1F1EB}\u{1F1F7}', name: 'Francais'),
];

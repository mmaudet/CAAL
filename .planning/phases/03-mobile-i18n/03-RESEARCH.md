# Phase 3: Mobile i18n - Research

**Researched:** 2026-01-25
**Domain:** Flutter localization with intl/ARB
**Confidence:** HIGH

## Summary

Flutter's official internationalization approach uses `flutter_localizations` SDK package combined with ARB (Application Resource Bundle) files and the `flutter gen-l10n` tool for code generation. This is the recommended approach for Flutter 3.x and provides type-safe access to localized strings with full IDE support.

The CAAL mobile app already has the `intl` package (0.20.0) as a dependency but lacks the `flutter_localizations` SDK package and ARB infrastructure. The app needs to mirror the frontend's language change flow: load from backend settings, allow user to change via selector, save to backend, and reload app with new locale.

**Primary recommendation:** Use Flutter's official `flutter gen-l10n` with ARB files, integrate with existing Provider state management, and mirror frontend's save-reload pattern for language changes.

## Standard Stack

The established libraries/tools for Flutter i18n:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| flutter_localizations | SDK | Material/Cupertino locale delegates | Official Flutter SDK package |
| intl | ^0.20.0 | Date/number formatting, ICU message syntax | Already in pubspec.yaml |
| flutter gen-l10n | Built-in | ARB to Dart code generation | Official Flutter tooling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shared_preferences | ^2.3.4 | Persist locale locally | Already in pubspec.yaml - for caching |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| flutter gen-l10n | easy_localization | More features but adds dependency, not official |
| ARB files | JSON + custom loader | Loses type safety and IDE support |
| Manual locale management | Riverpod | Overkill, app already uses Provider |

**Installation:**
```bash
flutter pub add flutter_localizations --sdk=flutter
```

Note: `intl` is already in pubspec.yaml at version 0.20.0.

## Architecture Patterns

### Recommended Project Structure
```
mobile/
├── lib/
│   ├── l10n/
│   │   ├── app_en.arb          # English template (source of truth)
│   │   └── app_fr.arb          # French translations
│   └── ... existing structure
├── l10n.yaml                    # Code generation config
└── pubspec.yaml                 # Updated with flutter_localizations
```

### Pattern 1: ARB File Structure

**What:** ARB files are JSON with metadata for translators and code generation.

**When to use:** All localizable strings in the app.

**Example (app_en.arb):**
```json
{
  "@@locale": "en",
  "welcomeSubtitle": "Chat live with your voice AI agent",
  "@welcomeSubtitle": {
    "description": "Subtitle on welcome screen"
  },
  "talkToAgent": "Talk to CAAL",
  "@talkToAgent": {
    "description": "Button text to start conversation"
  },
  "connecting": "Connecting",
  "@connecting": {
    "description": "Button text while connecting"
  },
  "agentListening": "CAAL is listening",
  "@agentListening": {
    "description": "Status text when agent is listening"
  },
  "settings": "Settings",
  "settingsSectionConnection": "Connection",
  "settingsSectionAgent": "Agent",
  "settingsSectionProviders": "Providers",
  "serverUrl": "Server URL",
  "serverUrlHint": "http://192.168.1.100:3000",
  "serverUrlRequired": "Server URL is required",
  "serverUrlInvalid": "Enter a valid URL",
  "connected": "Connected to CAAL server",
  "testConnection": "Test",
  "save": "Save",
  "connect": "CONNECT",
  "languageLabel": "Language",
  "languageEnglish": "English",
  "languageFrench": "Francais",
  "modelsAvailable": "{count} models available",
  "@modelsAvailable": {
    "description": "Shows count of available models",
    "placeholders": {
      "count": {
        "type": "int"
      }
    }
  }
}
```

### Pattern 2: l10n.yaml Configuration

**What:** Configuration file for `flutter gen-l10n`.

**When to use:** Always required for code generation.

**Example:**
```yaml
arb-dir: lib/l10n
template-arb-file: app_en.arb
output-localization-file: app_localizations.dart
output-class: AppLocalizations
nullable-getter: false
```

Key options:
- `nullable-getter: false` - Avoids null checks when accessing localizations
- `template-arb-file` - English is source of truth

### Pattern 3: MaterialApp Integration

**What:** Wire up localization delegates and locale.

**When to use:** In app.dart where MaterialApp is configured.

**Example:**
```dart
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

MaterialApp(
  locale: currentLocale, // From Provider or state
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  supportedLocales: const [
    Locale('en'),
    Locale('fr'),
  ],
  // ... rest of app
)
```

### Pattern 4: Locale Provider with Backend Sync

**What:** ChangeNotifier that holds current locale and syncs with backend.

**When to use:** For runtime locale changes that persist to backend.

**Example:**
```dart
class LocaleProvider extends ChangeNotifier {
  Locale _locale = const Locale('en');
  Locale get locale => _locale;

  // Load from backend settings on app start
  Future<void> loadFromSettings(String serverUrl) async {
    try {
      final response = await http.get(Uri.parse('$serverUrl/settings'));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final lang = data['settings']?['language'] ?? 'en';
        _locale = Locale(lang);
        notifyListeners();
      }
    } catch (e) {
      // Keep default locale on error
    }
  }

  // Change locale, save to backend, trigger rebuild
  Future<void> setLocale(Locale newLocale, String webhookUrl) async {
    if (newLocale == _locale) return;

    // Save to backend first
    await http.post(
      Uri.parse('$webhookUrl/settings'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'settings': {'language': newLocale.languageCode}}),
    );

    _locale = newLocale;
    notifyListeners();
  }
}
```

### Pattern 5: Accessing Localizations in Widgets

**What:** Type-safe access to localized strings.

**When to use:** Everywhere a string needs localization.

**Example:**
```dart
// In a widget's build method
final l10n = AppLocalizations.of(context);

Text(l10n.welcomeSubtitle);
Text(l10n.modelsAvailable(5)); // Plurals/interpolation
```

### Anti-Patterns to Avoid

- **Hardcoded strings:** Never write `Text('Hello')` - always use `Text(l10n.hello)`
- **Missing @@locale:** Every ARB file must have `"@@locale": "XX"` entry
- **Hot reload for ARB changes:** ARB file changes require full app restart, not hot reload
- **Forgetting pubspec.yaml generate flag:** Must have `flutter: generate: true`

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pluralization | Custom logic | intl ICU syntax | Handles all plural forms (zero, one, two, few, many, other) |
| Date formatting | DateFormat manually | intl DateFormat with locale | Automatic locale-aware formatting |
| RTL support | Manual layout flipping | Directionality widget | Built into Flutter localization |
| String interpolation | String concatenation | ARB placeholders | Type-safe, translator-friendly |

**Key insight:** ICU message syntax in ARB files handles complex pluralization and gender selection that would be error-prone to implement manually.

## Common Pitfalls

### Pitfall 1: Hot Reload Doesn't Update ARB Changes

**What goes wrong:** Developer changes ARB file, hot reloads, sees no change.
**Why it happens:** ARB files are compiled at build time, not runtime.
**How to avoid:** Full app restart (`flutter run` fresh) after ARB changes.
**Warning signs:** "I added the translation but it's not showing up"

### Pitfall 2: Missing @@locale in ARB Files

**What goes wrong:** Code generation fails or produces wrong locale.
**Why it happens:** ARB file named `app_fr.arb` but missing `"@@locale": "fr"`.
**How to avoid:** Always include `"@@locale": "XX"` as first entry in every ARB file.
**Warning signs:** Generated code missing expected locale or NPE at runtime.

### Pitfall 3: Forgetting generate: true in pubspec.yaml

**What goes wrong:** `flutter_gen/gen_l10n/app_localizations.dart` not generated.
**Why it happens:** Code generation disabled by default.
**How to avoid:** Add `flutter: generate: true` to pubspec.yaml.
**Warning signs:** Import error: `package:flutter_gen/gen_l10n/app_localizations.dart` not found.

### Pitfall 4: Missing Keys in Translation Files

**What goes wrong:** App crashes or shows empty string.
**Why it happens:** Key exists in English ARB but missing in French ARB.
**How to avoid:** Use same keys in all ARB files. Optional: use `untranslated-messages-file` in l10n.yaml.
**Warning signs:** Empty text or runtime assertion failures.

### Pitfall 5: Placeholder Type Mismatches

**What goes wrong:** Build error "Too few positional arguments" or type error.
**Why it happens:** ARB defines `{count}` as int but code passes String.
**How to avoid:** Match placeholder types between ARB metadata and Dart usage.
**Warning signs:** Type errors at compile time.

### Pitfall 6: MaterialApp Locale Not Reactive

**What goes wrong:** Changing locale in state doesn't update UI.
**Why it happens:** MaterialApp not consuming locale from Provider.
**How to avoid:** Use Consumer/Selector around MaterialApp with locale parameter.
**Warning signs:** Language selector changes state but UI doesn't update.

## Code Examples

Verified patterns from official Flutter documentation:

### l10n.yaml Configuration
```yaml
# Source: https://docs.flutter.dev/ui/internationalization
arb-dir: lib/l10n
template-arb-file: app_en.arb
output-localization-file: app_localizations.dart
output-class: AppLocalizations
nullable-getter: false
```

### pubspec.yaml Dependencies
```yaml
# Source: https://docs.flutter.dev/ui/internationalization
dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter
  intl: ^0.20.0  # Already present

flutter:
  generate: true  # REQUIRED for code generation
```

### MaterialApp with Localization Delegates
```dart
// Source: https://docs.flutter.dev/ui/internationalization
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

MaterialApp(
  locale: localeProvider.locale,
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  supportedLocales: AppLocalizations.supportedLocales,
  // ...
)
```

### Using Localizations in Widgets
```dart
// Source: https://docs.flutter.dev/ui/internationalization
@override
Widget build(BuildContext context) {
  final l10n = AppLocalizations.of(context);

  return Column(
    children: [
      Text(l10n.welcomeSubtitle),
      Text(l10n.modelsAvailable(count)), // With placeholder
    ],
  );
}
```

### Language Selector Widget Pattern
```dart
// Pattern matching frontend's settings-panel.tsx
DropdownButtonFormField<String>(
  value: currentLocale.languageCode,
  items: const [
    DropdownMenuItem(value: 'en', child: Text('English')),
    DropdownMenuItem(value: 'fr', child: Text('Francais')),
  ],
  onChanged: (value) async {
    if (value != null) {
      // Save to backend
      await saveLanguageToBackend(value);
      // Update provider (triggers MaterialApp rebuild)
      context.read<LocaleProvider>().setLocale(Locale(value));
    }
  },
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| flutter_intl VS Code extension | flutter gen-l10n built-in | Flutter 2.0+ | No extension needed |
| Manual locale provider | flutter gen-l10n with nullable-getter: false | Flutter 3.0 | Simpler null handling |
| Synthetic package output | Source output | Flutter 3.24 | Generated files in project |

**Deprecated/outdated:**
- `flutter_intl` VS Code extension: Still works but official tooling is preferred
- `intl_translation` package: Superseded by built-in `flutter gen-l10n`

## Open Questions

Things that couldn't be fully resolved:

1. **iOS App Store localization metadata**
   - What we know: Need to configure Xcode project for App Store to show supported languages
   - What's unclear: Whether this is needed for CAAL mobile (may not be on App Store)
   - Recommendation: Skip for now, add if publishing to App Store

2. **Optimal locale change UX**
   - What we know: Frontend uses toast + 500ms delay + reload
   - What's unclear: Whether Flutter needs full restart or just setState
   - Recommendation: Test with setState first; if issues, mirror frontend's reload approach

## Sources

### Primary (HIGH confidence)
- [Flutter Internationalization Documentation](https://docs.flutter.dev/ui/internationalization) - Complete guide
- [intl package 0.20.2](https://pub.dev/packages/intl) - ICU message syntax, date/number formatting

### Secondary (MEDIUM confidence)
- [Flutter Provider Localization Guide](https://flutterlocalisation.com/blog/flutter-provider-localization) - Provider integration patterns
- [13 Tips for ARB Files](https://yapb.dev/tips-and-tricks-13-tips-when-working-with-arb-files-for-localization) - Best practices
- [Common Flutter Localization Errors](https://flutterlocalisation.com/blog/flutter-localization-errors-fixes) - Pitfalls

### Tertiary (LOW confidence)
- WebSearch results for runtime locale changes - Community patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Flutter documentation
- Architecture: HIGH - Official patterns + existing codebase analysis
- Pitfalls: HIGH - Documented in official sources and community

**Research date:** 2026-01-25
**Valid until:** 2026-03-25 (60 days - Flutter i18n is stable)

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';

/// Language selector widget with flag buttons.
/// Displays available languages as emoji flags.
class LanguageSelector extends StatelessWidget {
  const LanguageSelector({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppLocalizations>(
      builder: (context, l10n, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: availableLocales.map((localeFlag) {
            final isSelected = l10n.locale == localeFlag.locale;
            return GestureDetector(
              onTap: () => l10n.setLocale(localeFlag.locale),
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 200),
                opacity: isSelected ? 1.0 : 0.5,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    localeFlag.flag,
                    style: const TextStyle(fontSize: 28),
                  ),
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

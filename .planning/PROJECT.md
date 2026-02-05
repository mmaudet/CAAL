# CAAL Internationalization

## What This Is

CAAL is a local voice assistant with multilingual support. v1.0 shipped full EN/FR/IT support across web UI, mobile app, and voice pipeline. This milestone completes i18n coverage for the Tool Registry feature added post-v1.0.

## Core Value

All UI text is internationalized — no hardcoded English strings in user-facing components.

## Current State

**Last shipped:** v1.1 Complete Tool Registry i18n (2026-02-05)

All user-facing frontend components are now fully internationalized with EN/FR/IT translations.

## Requirements

### Validated

<!-- Shipped in v1.0 -->

- ✓ Global language setting in settings.json — v1.0
- ✓ Language propagation to all components — v1.0
- ✓ Backward compatibility with English-only installations — v1.0
- ✓ Frontend i18n with next-intl (EN/FR) — v1.0
- ✓ Language selector in web settings panel — v1.0
- ✓ Mobile i18n with Flutter intl (EN/FR) — v1.0
- ✓ Per-language system prompts — v1.0
- ✓ STT language configuration — v1.0
- ✓ TTS voice mapping per language — v1.0
- ✓ Italian language support — v1.0.1 (cmac86)
- ✓ Language selector in setup wizard — v1.0.1 (cmac86)
- ✓ Localized settings panel and tools registry — v1.0.1 (cmac86)

<!-- Shipped in v1.1 -->

- ✓ workflow-submission-dialog.tsx fully internationalized — v1.1
- ✓ workflow-detail-modal.tsx fully internationalized — v1.1
- ✓ French translations for Tool Registry sharing UI — v1.1
- ✓ Italian translations for Tool Registry sharing UI — v1.1
- ✓ Translation style consistency verified — v1.1

### Active

(None — planning next milestone)

### Out of Scope

- Adding new languages beyond EN/FR/IT — future milestone
- Mobile app changes — no new strings added there
- Backend/agent changes — Tool Registry is frontend-only

## Context

**Post-v1.0 additions by cmac86:**
- Tool Registry feature with browse/install/share functionality
- Workflow submission dialog for sharing custom workflows
- Workflow detail modal for viewing custom workflow info
- These components have ~25 hardcoded English strings

**i18n infrastructure already in place:**
- next-intl configured with messages/{en,fr,it}.json
- useTranslations hook pattern established
- All other components properly internationalized

## Constraints

- **Tech stack**: next-intl (already configured)
- **Style**: Match existing translation conventions (tu/toi for French)
- **Upstream**: Changes should be PR-able back to CoreWorxLab/CAAL

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add keys to existing Tools namespace | Keeps related translations together | ✓ Good |
| French tu/toi register | Consistent with v1.0 prompt translations | ✓ Good |
| Technical terms in English | Clarity across languages (n8n, workflow, credentials) | ✓ Good |

---
*Last updated: 2026-02-05 after v1.1 milestone complete*

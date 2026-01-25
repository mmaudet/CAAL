---
phase: 02-frontend-i18n
plan: 02
subsystem: ui
tags: [next-intl, i18n, react, typescript, translations]

# Dependency graph
requires:
  - phase: 02-01
    provides: next-intl infrastructure, locale provider, middleware
provides:
  - Complete EN/FR translation message files (128 lines each)
  - Localized settings panel with language selector dropdown
  - Localized welcome view and setup wizard components
  - Cookie-based locale persistence with reload on change
affects: [03-mobile-i18n, 04-voice-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [namespaced translations, useTranslations hooks, CAAL_LOCALE cookie sync]

key-files:
  created: []
  modified:
    - frontend/messages/en.json
    - frontend/messages/fr.json
    - frontend/components/settings/settings-panel.tsx
    - frontend/components/app/welcome-view.tsx
    - frontend/components/setup/setup-wizard.tsx
    - frontend/components/setup/provider-step.tsx
    - frontend/components/setup/stt-step.tsx
    - frontend/components/setup/integrations-step.tsx

key-decisions:
  - "Technical terms stay in English: Ollama, Groq, Kokoro, Piper, STT, TTS, LLM, API, n8n"
  - "Language selector placed at top of Agent tab in settings"
  - "Language change triggers backend save, cookie update, and page reload"

patterns-established:
  - "Translation namespaces: Common, Welcome, Settings (nested), Setup"
  - "Always use t() for user-facing text, multiple useTranslations hooks per component"
  - "Cookie sync: CAAL_LOCALE set on settings load and language change"

# Metrics
duration: 6min
completed: 2026-01-25
---

# Phase 2 Plan 2: UI Localization Summary

**Complete EN/FR translations with 128-line message files, localized settings panel with language selector, and translated welcome/setup wizard components**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-25T18:23:37Z
- **Completed:** 2026-01-25T18:30:05Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Created comprehensive EN/FR message files with 128 lines each covering all UI namespaces
- Localized settings panel with 75+ translation calls and added language selector dropdown in Agent tab
- Localized welcome view, setup wizard, and all step components (provider, stt, integrations)
- Implemented language change flow: save to backend, update CAAL_LOCALE cookie, reload page

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EN/FR message files with all UI strings** - `1a6af3b` (feat)
2. **Task 2: Localize settings panel and add language selector** - `5b45066` (feat)
3. **Task 3: Localize welcome view and setup wizard** - `1e8c3bd` (feat)

## Files Created/Modified
- `frontend/messages/en.json` - English translations with Common, Welcome, Settings, Setup namespaces
- `frontend/messages/fr.json` - French translations mirroring EN structure
- `frontend/components/settings/settings-panel.tsx` - Full localization with language selector, cookie init/update
- `frontend/components/app/welcome-view.tsx` - Localized subtitle and settings tooltip
- `frontend/components/setup/setup-wizard.tsx` - Localized welcome, step titles, buttons
- `frontend/components/setup/provider-step.tsx` - Localized provider labels and descriptions
- `frontend/components/setup/stt-step.tsx` - Localized TTS engine labels and notes
- `frontend/components/setup/integrations-step.tsx` - Localized integration labels and notes

## Decisions Made
- Technical terms (Ollama, Groq, Kokoro, Piper, STT, TTS, LLM, API, n8n) remain in English per project guidelines
- Language selector placed prominently at top of Agent tab for easy access
- Language change triggers immediate save + cookie update + reload to apply new locale

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Prettier/ESLint import order errors on build - resolved by running `pnpm format` to auto-fix

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Frontend fully localized for EN/FR
- Cookie-based locale working for server-side rendering
- Ready for Phase 3: Mobile i18n (Flutter l10n setup)

---
*Phase: 02-frontend-i18n*
*Completed: 2026-01-25*

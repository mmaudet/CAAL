# Project Milestones: CAAL

## v1.1 Complete Tool Registry i18n (Shipped: 2026-02-05)

**Delivered:** Internationalized the Tool Registry components (workflow-submission-dialog, workflow-detail-modal) with French and Italian translations, completing i18n coverage for all user-facing frontend components.

**Phases completed:** 5-7 (3 plans total)

**Key accomplishments:**

- Extracted 22 hardcoded English strings from workflow-submission-dialog and workflow-detail-modal
- Added Tools.share.* (12 keys) and Tools.workflow.* (10 keys) to message files
- French translations with tu/toi informal register (matching voice assistant tone)
- Italian translations with identical key structure
- Verified zero hardcoded strings remain, all 3 languages structurally identical

**Stats:**

- 17 files modified
- +1,428 / -72 lines (TypeScript, JSON)
- 3 phases, 3 plans, 12 commits
- 1 day (2026-02-05)

**Git range:** `3f4d594` to `e5e7cee`

**What's next:** Planning next milestone

---

## v1.0 Multilingual Support (Shipped: 2026-01-26)

**Delivered:** Full multilingual support (EN/FR) across the entire CAAL stack — web UI, mobile app, and voice pipeline — controlled by a single global language setting.

**Phases completed:** 1-4 (7 plans total)

**Key accomplishments:**

- Global language setting infrastructure with propagation to all components
- Complete Next.js i18n with next-intl, EN/FR translations (128 keys), language selector
- Complete Flutter i18n with ARB files, LocaleProvider, all screens localized
- Language-aware voice pipeline: STT language param, TTS voice mapping, localized prompts
- Per-language wake greetings with automatic language-appropriate defaults
- Auto-switch from Kokoro to Piper TTS for non-English languages

**Stats:**

- 65 files created/modified
- +8,501 / -565 lines (Python, TypeScript, Dart)
- 4 phases, 7 plans, 37 commits
- 2 days from start to ship (2026-01-25 to 2026-01-26)

**Git range:** `97879a7` to `e0105d1`

**Post-v1.0 additions (cmac86):**
- Italian language support (full stack)
- Language selector in setup wizard
- Tool Registry feature (browse/install/share)
- Wake greetings moved to file-based storage
- PIPER_VOICE_MAP centralized in settings.py

---

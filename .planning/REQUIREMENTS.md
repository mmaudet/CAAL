# Requirements: CAAL i18n v1.1

**Defined:** 2026-02-05
**Core Value:** All UI text is internationalized — no hardcoded English strings

## v1.1 Requirements

Requirements for Tool Registry i18n completion.

### Internationalization Infrastructure

- [x] **I18N-01**: workflow-submission-dialog.tsx uses useTranslations hook
- [x] **I18N-02**: workflow-detail-modal.tsx uses useTranslations hook
- [x] **I18N-03**: All hardcoded strings extracted to message keys

### English Message Keys

- [x] **EN-01**: Tools.share.* keys added to en.json for submission dialog
- [x] **EN-02**: Tools.workflow.* keys added to en.json for detail modal

### French Translations

- [x] **FR-01**: Tools.share.* keys translated in fr.json
- [x] **FR-02**: Tools.workflow.* keys translated in fr.json
- [x] **FR-03**: French translations use tu/toi register consistently

### Italian Translations

- [x] **IT-01**: Tools.share.* keys translated in it.json
- [x] **IT-02**: Tools.workflow.* keys translated in it.json

### Quality Assurance

- [ ] **QA-01**: No hardcoded English strings remain in target components
- [ ] **QA-02**: Translation style consistent with existing messages
- [ ] **QA-03**: All three languages (EN/FR/IT) have identical key structure

## Out of Scope

| Feature | Reason |
|---------|--------|
| New languages | Infrastructure supports it, content deferred |
| Mobile changes | No new strings added to mobile |
| Backend i18n | Tool Registry is frontend-only |
| tool-install-modal.tsx | Already uses translations |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| I18N-01 | Phase 5 | Complete |
| I18N-02 | Phase 5 | Complete |
| I18N-03 | Phase 5 | Complete |
| EN-01 | Phase 5 | Complete |
| EN-02 | Phase 5 | Complete |
| FR-01 | Phase 6 | Complete |
| FR-02 | Phase 6 | Complete |
| FR-03 | Phase 6 | Complete |
| IT-01 | Phase 6 | Complete |
| IT-02 | Phase 6 | Complete |
| QA-01 | Phase 7 | Pending |
| QA-02 | Phase 7 | Pending |
| QA-03 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after Phase 6 complete*

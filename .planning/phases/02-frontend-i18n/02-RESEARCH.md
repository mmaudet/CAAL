# Phase 2: Frontend i18n - Research

**Researched:** 2026-01-25
**Domain:** Next.js App Router internationalization with next-intl (no URL routing)
**Confidence:** HIGH

## Summary

This research covers implementing frontend internationalization for CAAL using next-intl v4.7 without locale-based URL routing. The language setting comes from the backend `/api/settings` endpoint rather than URL segments or browser cookies. This is the "without i18n routing" configuration pattern from next-intl.

The key architectural decision is using next-intl's "without i18n routing" setup because:
1. CAAL already has a settings system that stores user preferences on the backend
2. The language setting must persist across devices (backend is source of truth)
3. No need for URL locale prefixes (`/fr/settings`) - same URLs for all languages
4. Simpler implementation - no middleware locale detection needed

**Primary recommendation:** Use next-intl's "without i18n routing" pattern, read locale from backend settings API, store in React context for client components, and load only the active language's messages.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-intl | ^4.7.0 | UI translations | De facto standard for Next.js App Router; 7% smaller bundle than v3; TypeScript support; ICU message format |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | (existing) | Toast notifications | Already in use - toasts need i18n for "Language updated" message |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next-intl | react-intl | Heavier bundle, less App Router integration |
| next-intl | next-i18next | Pages Router focused, awkward with App Router |
| next-intl | lingui | More complex setup, better for large translation teams |

**Installation:**
```bash
cd frontend && pnpm add next-intl
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/
  messages/
    en.json          # English translations (reference)
    fr.json          # French translations
  src/
    i18n/
      request.ts     # Server-side locale configuration
      config.ts      # Supported locales list
  app/
    layout.tsx       # NextIntlClientProvider wrapper
  components/
    settings/
      language-selector.tsx  # New: dropdown component
```

### Pattern 1: Without i18n Routing Setup
**What:** Configure next-intl to read locale from a source other than URL
**When to use:** When language preference is stored externally (backend, user profile)
**Example:**
```typescript
// src/i18n/config.ts
export const locales = ['en', 'fr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale } from './config';

export default getRequestConfig(async () => {
  // Read from cookie set by client after fetching from backend
  const cookieStore = await cookies();
  const locale = cookieStore.get('CAAL_LOCALE')?.value || defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
```
Source: [next-intl docs - without i18n routing](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing)

### Pattern 2: NextIntlClientProvider at Root
**What:** Wrap app with provider in root layout, messages passed from server
**When to use:** Always - enables useTranslations in all client components
**Example:**
```typescript
// app/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```
Source: [next-intl docs - configuration](https://next-intl.dev/docs/usage/configuration)

### Pattern 3: Language Change with Page Reload
**What:** Save language to backend, update cookie, reload page
**When to use:** Per CONTEXT.md - language changes trigger reload
**Example:**
```typescript
// components/settings/language-selector.tsx
import { toast } from 'sonner';

async function handleLanguageChange(newLocale: string) {
  // Save to backend
  await fetch('/api/settings', {
    method: 'POST',
    body: JSON.stringify({ settings: { language: newLocale } })
  });

  // Update cookie for next request
  document.cookie = `CAAL_LOCALE=${newLocale};path=/;max-age=31536000`;

  // Show feedback then reload
  toast.success(newLocale === 'fr' ? 'Langue mise a jour' : 'Language updated');
  setTimeout(() => window.location.reload(), 500);
}
```

### Pattern 4: Namespaced Messages
**What:** Organize translations by component/feature
**When to use:** Always - improves maintainability
**Example:**
```json
// messages/en.json
{
  "Settings": {
    "title": "Settings",
    "tabs": {
      "agent": "Agent",
      "prompt": "Prompt",
      "providers": "Providers",
      "llm": "LLM Settings",
      "integrations": "Integrations",
      "wake": "Wake Word"
    },
    "language": {
      "label": "Language",
      "description": "Choose your preferred language"
    },
    "save": "Save Changes",
    "saving": "Saving..."
  },
  "Welcome": {
    "subtitle": "Chat live with your voice AI agent",
    "start": "Start"
  }
}
```

### Anti-Patterns to Avoid
- **Hardcoding strings in components:** All user-visible text must be in message files
- **Using locale in URL:** Project decision is no URL routing - locale from backend only
- **Using next-intl middleware:** Not needed for without-i18n-routing pattern
- **Storing locale in localStorage:** Backend is source of truth per CONTEXT.md

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Translation loading | Manual JSON imports | next-intl getMessages | Handles caching, typing |
| Pluralization | Manual if/else | ICU MessageFormat via next-intl | Complex rules per language |
| Message interpolation | Template literals | t('key', {name}) | Type-safe, escapes HTML |
| Locale context | Custom React context | NextIntlClientProvider | Integrates with Next.js |
| Language detection | navigator.language | Backend settings API | Persistence across devices |

**Key insight:** i18n looks simple ("just key-value pairs") but has edge cases: plurals differ by language (French pluralizes at 2, not 1), gender agreement, number formatting, etc. next-intl handles these via ICU MessageFormat.

## Common Pitfalls

### Pitfall 1: Breaking Static Rendering
**What goes wrong:** Using `useTranslations` in Server Components without `setRequestLocale` causes dynamic rendering
**Why it happens:** next-intl needs to know locale at render time; without explicit setting it falls back to headers() which forces dynamic
**How to avoid:** Not applicable - we're using "without i18n routing" pattern which doesn't use `[locale]` segment, so static rendering is preserved by default
**Warning signs:** Build output shows pages as "dynamic" instead of "static"
**Note:** Since we're NOT using locale-based routing, we don't need `setRequestLocale` or `generateStaticParams` - these are only for the `[locale]` segment pattern

Source: [next-intl static rendering](https://next-intl.dev/docs/routing/setup)

### Pitfall 2: Hydration Mismatch on Language Change
**What goes wrong:** Server renders with old locale, client has new locale from cookie
**Why it happens:** Cookie set after server render completes
**How to avoid:** Full page reload after language change (per CONTEXT.md decision)
**Warning signs:** Console hydration errors, flash of wrong language

### Pitfall 3: Missing Translation Fallback Silent
**What goes wrong:** Missing translation key shows key path instead of fallback text
**Why it happens:** next-intl default behavior shows key on missing translation
**How to avoid:** Configure fallback to English messages
**Example:**
```typescript
// src/i18n/request.ts
export default getRequestConfig(async () => {
  const locale = /* ... */;

  // Load English as base, overlay with target locale
  const englishMessages = (await import('../../messages/en.json')).default;
  const localeMessages = locale !== 'en'
    ? (await import(`../../messages/${locale}.json`)).default
    : {};

  return {
    locale,
    messages: { ...englishMessages, ...localeMessages }  // English fallback
  };
});
```

### Pitfall 4: Hardcoded Strings in Settings Panel
**What goes wrong:** Large settings-panel.tsx has many hardcoded strings that get missed
**Why it happens:** ~1162 lines of code with labels, descriptions, placeholders scattered throughout
**How to avoid:** Systematic extraction - use grep to find all string literals before translating
**Warning signs:** French UI still shows English text in various places

### Pitfall 5: Error Messages Translated
**What goes wrong:** Error messages translated, support can't help users
**Why it happens:** Treating all text as translatable
**How to avoid:** Keep error messages in English with error codes (per CONTEXT.md)
**Example:**
```typescript
// Good: Keep errors in English
toast.error('Connection failed (ERR_CONN_001)');

// Bad: Translated error loses context for support
toast.error(t('Errors.connectionFailed'));
```

## Code Examples

Verified patterns from official sources:

### next.config.ts with next-intl plugin
```typescript
// Source: https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default withNextIntl(nextConfig);
```

### Using translations in Client Component
```typescript
// Source: https://next-intl.dev/docs/usage/configuration
'use client';
import { useTranslations } from 'next-intl';

export function SettingsPanel() {
  const t = useTranslations('Settings');

  return (
    <h1>{t('title')}</h1>
    // ...
  );
}
```

### Loading locale from cookie (synced with backend)
```typescript
// src/i18n/request.ts
// Source: https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('CAAL_LOCALE')?.value || 'en';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
```

### Language Selector Component Pattern
```typescript
// components/settings/language-selector.tsx
'use client';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Francais' },
] as const;

interface LanguageSelectorProps {
  currentLanguage: string;
  onSave: () => Promise<void>;
}

export function LanguageSelector({ currentLanguage, onSave }: LanguageSelectorProps) {
  const [selected, setSelected] = useState(currentLanguage);

  return (
    <select
      value={selected}
      onChange={(e) => setSelected(e.target.value)}
      className="border-input bg-background w-full rounded-lg border px-4 py-3 text-sm"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `unstable_setRequestLocale` | `setRequestLocale` | next-intl 3.22 | Stable API, same usage |
| Pages Router i18n | App Router native | Next.js 13+ | Better server components |
| `next-i18next` | `next-intl` | 2024 | Purpose-built for App Router |

**Deprecated/outdated:**
- `unstable_setRequestLocale`: Renamed to `setRequestLocale` (stable)
- Using `[locale]` segment for all pages: "without i18n routing" pattern is simpler when locale from external source

## Integration with Existing CAAL Frontend

### Current Frontend Structure Analysis

The CAAL frontend uses:
- Next.js 15 with App Router (`app/` directory)
- Route group `(app)/` containing main layout and page
- `components/settings/settings-panel.tsx` - 1162 lines, many hardcoded strings
- `components/setup/setup-wizard.tsx` - Setup wizard with step titles
- `components/app/welcome-view.tsx` - Welcome screen
- `sonner` for toast notifications (already installed)
- `next-themes` for dark mode

### Settings Panel Analysis

The settings-panel.tsx contains these hardcoded string categories:
1. **Tab labels:** Agent, Prompt, Providers, LLM Settings, Integrations, Wake Word
2. **Field labels:** Agent Name, Voice, Wake Greetings, Host URL, API Key, etc.
3. **Button text:** Save Changes, Test, Back, Continue
4. **Descriptions:** Helper text for each setting
5. **Status messages:** "Loading settings...", "Saving...", "Testing..."
6. **Error/success messages:** "Failed to load settings", "X models available"

Estimated translation keys: ~100-150 strings

### Language Flow Architecture

```
Backend (settings.json)           Frontend
        |
        v
   /api/settings GET  ------>  App loads, fetches settings
        |                              |
        |                              v
        |                      Set CAAL_LOCALE cookie
        |                              |
        v                              v
   language: "fr"              Next request uses cookie
                                       |
                                       v
                               i18n/request.ts reads cookie
                                       |
                                       v
                               Load fr.json messages
                                       |
                                       v
                               Render UI in French
```

### Integration Points

1. **app/layout.tsx** - Add NextIntlClientProvider
2. **components/settings/settings-panel.tsx** - Replace all strings with t() calls
3. **components/setup/setup-wizard.tsx** - Localize setup wizard
4. **components/app/welcome-view.tsx** - Localize welcome text
5. **Various modals and toasts** - Localize user-facing messages

## Open Questions

Things that couldn't be fully resolved:

1. **Initial load before settings fetch**
   - What we know: Need to show English by default while settings load
   - What's unclear: Exact timing - does settings API respond before first render?
   - Recommendation: Use 'en' as cookie default if not set; app.tsx should set cookie after settings fetch

2. **Technical terms consistency**
   - What we know: CONTEXT.md says keep Groq, Ollama, Whisper, STT, TTS in English
   - What's unclear: Full list of technical terms to preserve
   - Recommendation: Create TECHNICAL_TERMS.md listing all terms to keep in English

## Sources

### Primary (HIGH confidence)
- [next-intl without i18n routing docs](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing) - Core setup pattern
- [next-intl configuration docs](https://next-intl.dev/docs/usage/configuration) - getRequestConfig, messages loading
- [next-intl routing setup](https://next-intl.dev/docs/routing/setup) - setRequestLocale explanation (for reference, not used in our pattern)

### Secondary (MEDIUM confidence)
- [next-intl GitHub Discussion #1096](https://github.com/amannn/next-intl/discussions/1096) - App router without routing, locale switching
- Existing CAAL frontend code analysis - settings-panel.tsx, layout.tsx, welcome-view.tsx

### Tertiary (LOW confidence)
- None - all findings verified with official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - next-intl is well-documented, verified with official docs
- Architecture: HIGH - "without i18n routing" pattern explicitly documented
- Pitfalls: HIGH - pitfalls from PITFALLS.md plus next-intl specific issues verified
- Integration: HIGH - direct analysis of CAAL frontend source code

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (30 days - next-intl is stable)

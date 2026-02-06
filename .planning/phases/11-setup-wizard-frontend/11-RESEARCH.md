# Phase 11: Setup Wizard Frontend - Research

**Researched:** 2026-02-06
**Domain:** Next.js Setup Wizard UI, Provider Configuration Forms
**Confidence:** HIGH

## Summary

This phase extends the existing setup wizard to include OpenAI-compatible and OpenRouter as provider choices. The work is straightforward because:

1. **The existing `provider-step.tsx` has a complete pattern** for provider selection with connection testing, model discovery, and error handling. The new providers follow the exact same flow.

2. **All backend work is complete:**
   - Phase 8: Provider classes created
   - Phase 9: Settings keys added (`openai_api_key`, `openai_base_url`, `openai_model`, `openrouter_api_key`, `openrouter_model`)
   - Phase 10: Test endpoints (`/api/setup/test-openai-compatible`, `/api/setup/test-openrouter`) and proxy routes created

3. **The SetupData interface just needs extending** with the new fields, and the existing patterns for Ollama (host URL + model) and Groq (API key + model) map directly to the new providers.

The setup wizard currently uses a 2-column grid for provider selection (Ollama, Groq). Adding two more providers requires changing to a 4-column grid or 2x2 layout, and adding corresponding form sections with test buttons.

**Primary recommendation:** Extend `SetupData` interface with new provider fields, expand the provider grid to 4 options (2x2), and add form sections following the existing Ollama/Groq patterns exactly.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | Component framework | Already used in frontend |
| next-intl | installed | i18n translations | Already used in provider-step.tsx |
| @phosphor-icons | installed | Status icons (Check, X, CircleNotch) | Already used for test status |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5.x | Type safety | Already configured |
| TailwindCSS v4 | 4.x | Styling | Already used in all components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline form sections | Separate components per provider | Overkill - patterns are simple, extraction adds indirection |
| Combobox for model search | Select dropdown | OpenRouter has 400+ models; combobox would be better UX but adds complexity for first version |

**Installation:**
```bash
# No installation needed - all already available
```

## Architecture Patterns

### Recommended SetupData Extension
```typescript
// Source: frontend/components/setup/setup-wizard.tsx (existing)
export interface SetupData {
  // Existing LLM Provider
  llm_provider: 'ollama' | 'groq' | 'openai_compatible' | 'openrouter';
  ollama_host: string;
  ollama_model: string;
  groq_api_key: string;
  groq_model: string;

  // NEW: OpenAI-compatible settings
  openai_base_url: string;
  openai_api_key: string;  // Optional for some servers
  openai_model: string;

  // NEW: OpenRouter settings
  openrouter_api_key: string;
  openrouter_model: string;

  // ... rest of existing fields unchanged
}
```

### Pattern 1: Provider Grid Layout (2x2)
**What:** Display all four providers in a 2x2 grid
**When to use:** Setup wizard provider selection
**Example:**
```tsx
// Source: Derived from existing provider-step.tsx pattern
<div className="grid grid-cols-2 gap-2">
  {/* Row 1 */}
  <button onClick={() => updateData({ llm_provider: 'ollama' })} ...>
    <div className="font-medium">Ollama</div>
    <div className="text-muted-foreground text-xs">{t('ollamaDesc')}</div>
  </button>
  <button onClick={() => updateData({ llm_provider: 'groq' })} ...>
    <div className="font-medium">Groq</div>
    <div className="text-muted-foreground text-xs">{t('groqDesc')}</div>
  </button>
  {/* Row 2 */}
  <button onClick={() => updateData({ llm_provider: 'openai_compatible' })} ...>
    <div className="font-medium">OpenAI Compatible</div>
    <div className="text-muted-foreground text-xs">{t('openaiCompatibleDesc')}</div>
  </button>
  <button onClick={() => updateData({ llm_provider: 'openrouter' })} ...>
    <div className="font-medium">OpenRouter</div>
    <div className="text-muted-foreground text-xs">{t('openrouterDesc')}</div>
  </button>
</div>
```

### Pattern 2: OpenAI-Compatible Form Section
**What:** Base URL (required), API key (optional), model selection after test
**When to use:** When `llm_provider === 'openai_compatible'`
**Example:**
```tsx
// Source: Derived from Ollama pattern + Phase 10 endpoint signature
{data.llm_provider === 'openai_compatible' && (
  <div className="space-y-3">
    <div className="space-y-1">
      <label className="text-sm font-medium">{t('baseUrl')}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={data.openai_base_url}
          onChange={(e) => updateData({ openai_base_url: e.target.value })}
          placeholder="http://localhost:8000/v1"
          className="border-input bg-background flex-1 rounded-md border px-3 py-2"
        />
        <button
          onClick={testOpenAICompatible}
          disabled={!data.openai_base_url || testStatus === 'testing'}
          className="..."
        >
          <StatusIcon />
          {tCommon('test')}
        </button>
      </div>
      {testError && <p className="text-xs text-red-500">{testError}</p>}
    </div>

    <div className="space-y-1">
      <label className="text-sm font-medium">{t('apiKey')} ({t('optional')})</label>
      <input
        type="password"
        value={data.openai_api_key}
        onChange={(e) => updateData({ openai_api_key: e.target.value })}
        placeholder={t('optionalApiKeyPlaceholder')}
        className="border-input bg-background w-full rounded-md border px-3 py-2"
      />
      <p className="text-muted-foreground text-xs">{t('openaiApiKeyNote')}</p>
    </div>

    {openaiModels.length > 0 && (
      <div className="space-y-1">
        <label className="text-sm font-medium">{t('model')}</label>
        <select ...>
          {openaiModels.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
      </div>
    )}
  </div>
)}
```

### Pattern 3: OpenRouter Form Section
**What:** API key (required), model selection with potential for search
**When to use:** When `llm_provider === 'openrouter'`
**Example:**
```tsx
// Source: Derived from Groq pattern + Phase 10 endpoint signature
{data.llm_provider === 'openrouter' && (
  <div className="space-y-3">
    <div className="space-y-1">
      <label className="text-sm font-medium">{t('apiKey')}</label>
      <div className="flex gap-2">
        <input
          type="password"
          value={data.openrouter_api_key}
          onChange={(e) => updateData({ openrouter_api_key: e.target.value })}
          placeholder="sk-or-..."
          className="border-input bg-background flex-1 rounded-md border px-3 py-2"
        />
        <button
          onClick={testOpenRouter}
          disabled={!data.openrouter_api_key || testStatus === 'testing'}
          className="..."
        >
          <StatusIcon />
          {tCommon('test')}
        </button>
      </div>
      {testError && <p className="text-xs text-red-500">{testError}</p>}
      <p className="text-muted-foreground text-xs">
        {t('getApiKeyAt')}{' '}
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
           className="text-primary underline">openrouter.ai</a>
      </p>
    </div>

    {openrouterModels.length > 0 && (
      <div className="space-y-1">
        <label className="text-sm font-medium">{t('model')}</label>
        <select ...>
          {openrouterModels.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
      </div>
    )}
  </div>
)}
```

### Pattern 4: Test Connection Functions
**What:** Async test functions that call backend endpoints and update state
**When to use:** Each provider needs its own test function
**Example:**
```tsx
// Source: Derived from existing testOllama/testGroq patterns
const testOpenAICompatible = useCallback(async () => {
  if (!data.openai_base_url) return;

  setTestStatus('testing');
  setTestError(null);

  try {
    const response = await fetch('/api/setup/test-openai-compatible', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_url: data.openai_base_url,
        api_key: data.openai_api_key,  // May be empty
      }),
    });

    const result = await response.json();

    if (result.success) {
      setTestStatus('success');
      setOpenaiModels(result.models || []);
      if (!data.openai_model && result.models?.length > 0) {
        updateData({ openai_model: result.models[0] });
      }
    } else {
      setTestStatus('error');
      setTestError(result.error || 'Connection failed');
    }
  } catch {
    setTestStatus('error');
    setTestError('Failed to connect');
  }
}, [data.openai_base_url, data.openai_api_key, data.openai_model, updateData]);
```

### Pattern 5: canProceed Validation Extension
**What:** Extend the validation logic to check new provider fields
**When to use:** Setup wizard footer button enable/disable logic
**Example:**
```tsx
// Source: Extend existing canProceed in setup-wizard.tsx
const canProceed = () => {
  if (step === 1) {
    switch (data.llm_provider) {
      case 'ollama':
        return data.ollama_host && data.ollama_model;
      case 'groq':
        return data.groq_api_key && data.groq_model;
      case 'openai_compatible':
        return data.openai_base_url && data.openai_model;
      case 'openrouter':
        return data.openrouter_api_key && data.openrouter_model;
      default:
        return false;
    }
  }
  // ... rest unchanged
};
```

### Anti-Patterns to Avoid
- **Sharing test state across providers:** Each provider should track its own models array (e.g., `openaiModels`, `openrouterModels`)
- **Not resetting state on provider switch:** Clear test status and error when user changes provider selection
- **Requiring API key for OpenAI-compatible:** Some local servers (vLLM, Ollama) don't need auth
- **Not disabling Test button during testing:** Prevents duplicate requests

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model filtering for OpenRouter | Client-side search | Backend filter via `supported_parameters=tools` | Already implemented in Phase 10 |
| Connection test debouncing | Custom debounce | `testStatus === 'testing'` disable | Existing pattern works |
| Error message localization | Inline strings | i18n keys in messages/*.json | Consistent with codebase |
| Form validation | Custom validation | Backend returns descriptive errors | Phase 10 provides clear messages |

**Key insight:** The backend already returns filtered, tool-capable models for OpenRouter and descriptive error messages. The frontend just needs to display what the backend returns.

## Common Pitfalls

### Pitfall 1: Forgetting INITIAL_DATA Defaults
**What goes wrong:** New fields are undefined, causing TypeScript errors or runtime issues
**Why it happens:** SetupData interface updated but INITIAL_DATA constant not updated
**How to avoid:** Always update both the interface AND the INITIAL_DATA constant with matching fields
**Warning signs:** TypeScript errors about possibly undefined, or controlled/uncontrolled input warnings

### Pitfall 2: Test Status Shared Across Providers
**What goes wrong:** Test status from Ollama shows when viewing OpenAI-compatible settings
**Why it happens:** Using a single `testStatus` state for all providers
**How to avoid:** Either reset status on provider change (current approach) or use separate status per provider
**Warning signs:** Green checkmark showing for untested provider

### Pitfall 3: Missing i18n Keys
**What goes wrong:** Raw i18n keys displayed instead of translated text
**Why it happens:** Keys added to code but not to messages/en.json and messages/fr.json
**How to avoid:** Add translations for BOTH languages before testing
**Warning signs:** Text like "Settings.providers.openaiCompatibleDesc" displayed in UI

### Pitfall 4: OpenRouter Model List Too Long
**What goes wrong:** Select dropdown becomes unwieldy with 100+ models
**Why it happens:** OpenRouter returns all tool-capable models (could be 100-200+)
**How to avoid:** For v1, accept that it's a long list. Future improvement: add search/combobox
**Warning signs:** Very long dropdown, slow rendering (though unlikely with React 19)

### Pitfall 5: API Key Visibility
**What goes wrong:** API key shown in plain text
**Why it happens:** Forgot to use `type="password"` on input
**How to avoid:** Always use `type="password"` for API key fields (existing pattern)
**Warning signs:** API key visible when typing

### Pitfall 6: Provider Descriptions Inconsistent
**What goes wrong:** Provider cards have inconsistent description styles or lengths
**Why it happens:** Ad-hoc copywriting instead of following pattern
**How to avoid:** Keep descriptions short and consistent: "[3-5 words describing key benefit]"
**Warning signs:** One card has 2 lines, another has 1 line

## Code Examples

### Complete SetupData Interface (Updated)
```typescript
// Source: frontend/components/setup/setup-wizard.tsx
export interface SetupData {
  // LLM Provider
  llm_provider: 'ollama' | 'groq' | 'openai_compatible' | 'openrouter';
  // Ollama
  ollama_host: string;
  ollama_model: string;
  // Groq
  groq_api_key: string;
  groq_model: string;
  // OpenAI-compatible (NEW)
  openai_base_url: string;
  openai_api_key: string;
  openai_model: string;
  // OpenRouter (NEW)
  openrouter_api_key: string;
  openrouter_model: string;
  // TTS Provider
  tts_provider: 'kokoro' | 'piper';
  tts_voice_kokoro: string;
  tts_voice_piper: string;
  // Integrations
  hass_enabled: boolean;
  hass_host: string;
  hass_token: string;
  n8n_enabled: boolean;
  n8n_url: string;
  n8n_token: string;
}
```

### Complete INITIAL_DATA Constant (Updated)
```typescript
// Source: frontend/components/setup/setup-wizard.tsx
const INITIAL_DATA: SetupData = {
  llm_provider: 'ollama',
  ollama_host: 'http://localhost:11434',
  ollama_model: '',
  groq_api_key: '',
  groq_model: '',
  openai_base_url: '',       // NEW
  openai_api_key: '',        // NEW
  openai_model: '',          // NEW
  openrouter_api_key: '',    // NEW
  openrouter_model: '',      // NEW
  tts_provider: 'kokoro',
  tts_voice_kokoro: 'am_puck',
  tts_voice_piper: 'speaches-ai/piper-en_US-ryan-high',
  hass_enabled: false,
  hass_host: '',
  hass_token: '',
  n8n_enabled: false,
  n8n_url: '',
  n8n_token: '',
};
```

### i18n Keys to Add (en.json)
```json
{
  "Settings": {
    "providers": {
      "openaiCompatibleDesc": "Self-hosted or third-party OpenAI-compatible API",
      "openrouterDesc": "Access 200+ models via unified API",
      "baseUrl": "Base URL",
      "optional": "optional",
      "openaiApiKeyNote": "Leave empty if your server doesn't require authentication",
      "openaiCompatibleSttNote": "Using OpenAI-compatible enables local speech-to-text via Speaches."
    }
  }
}
```

### i18n Keys to Add (fr.json)
```json
{
  "Settings": {
    "providers": {
      "openaiCompatibleDesc": "API compatible OpenAI auto-hebergee ou tierce",
      "openrouterDesc": "Acces a plus de 200 modeles via API unifiee",
      "baseUrl": "URL de base",
      "optional": "optionnel",
      "openaiApiKeyNote": "Laissez vide si votre serveur ne necessite pas d'authentification",
      "openaiCompatibleSttNote": "L'utilisation d'OpenAI-compatible active la reconnaissance vocale locale via Speaches."
    }
  }
}
```

### Test Endpoint Request/Response Reference
```typescript
// OpenAI-compatible endpoint
// POST /api/setup/test-openai-compatible
// Request: { base_url: string, api_key?: string }
// Response: { success: boolean, error?: string, models?: string[] }

// OpenRouter endpoint
// POST /api/setup/test-openrouter
// Request: { api_key: string }
// Response: { success: boolean, error?: string, models?: string[] }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2-column provider grid | 2x2 provider grid | This phase | Accommodates 4 providers |
| Single provider type union | Extended union | This phase | TypeScript support for new providers |

**Deprecated/outdated:**
- None - this is net-new functionality

## Open Questions

1. **OpenRouter Model Search UX**
   - What we know: OpenRouter may return 100+ tool-capable models
   - What's unclear: Whether a simple select is sufficient or combobox is needed
   - Recommendation: Ship with select dropdown for v1. If feedback indicates it's unwieldy, add combobox in a follow-up phase.

2. **STT Provider Note Display**
   - What we know: Ollama/Groq have notes about which STT is used with them
   - What's unclear: Should openai_compatible and openrouter have similar notes?
   - Recommendation: Yes - add notes explaining STT coupling (openai_compatible -> Speaches, openrouter -> Groq Whisper, matching Phase 9 webhook coupling logic).

## Sources

### Primary (HIGH confidence)
- `frontend/components/setup/provider-step.tsx` - Existing provider form patterns (Ollama, Groq)
- `frontend/components/setup/setup-wizard.tsx` - SetupData interface, INITIAL_DATA, canProceed logic
- `frontend/app/api/setup/test-openai-compatible/route.ts` - OpenAI-compatible proxy route (Phase 10)
- `frontend/app/api/setup/test-openrouter/route.ts` - OpenRouter proxy route (Phase 10)
- `.planning/phases/10-connection-testing-endpoints/10-RESEARCH.md` - Backend endpoint contract
- `.planning/phases/09-settings-schema-extension/09-RESEARCH.md` - Settings keys reference

### Secondary (MEDIUM confidence)
- `frontend/messages/en.json` - Existing i18n structure and key patterns
- `frontend/components/settings/settings-panel.tsx` - Reference for similar provider UI (more complex)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use
- Architecture: HIGH - Follows existing patterns exactly
- Pitfalls: HIGH - Derived from codebase analysis and existing similar code

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable domain, 30 days)

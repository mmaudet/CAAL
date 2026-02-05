# Architecture Research: LLM Providers

**Domain:** Adding OpenAI-compatible and OpenRouter providers to CAAL voice assistant
**Researched:** 2026-02-05
**Confidence:** HIGH

## Summary

CAAL has a clean provider abstraction pattern that separates provider-specific API logic from the agent pipeline. New providers integrate through a three-layer architecture: abstract base class, concrete provider implementation, and factory functions. The architecture is well-designed for extension.

## Existing Architecture Overview

### Component Layers

```
┌─────────────────────────────────────────────────────────┐
│ voice_agent.py (entrypoint)                             │
│  - Loads settings from settings.json                     │
│  - Creates CAALLLM via CAALLLM.from_settings()          │
│  - Passes CAALLLM to VoiceAssistant                     │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ src/caal/llm/caal_llm.py (LiveKit LLM interface)       │
│  - CAALLLM.from_settings() → create_provider_from_settings() │
│  - Wraps LLMProvider for LiveKit compatibility         │
│  - Exposes .provider_instance for llm_node access       │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ src/caal/llm/providers/__init__.py (factory)           │
│  - create_provider(name, **kwargs) → LLMProvider        │
│  - create_provider_from_settings(dict) → LLMProvider    │
│  - Maps provider names to concrete classes              │
└──────────────────┬──────────────────────────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
┌─────────▼──────┐  ┌──────▼──────────┐
│ OllamaProvider │  │ GroqProvider    │
│ (concrete)     │  │ (concrete)      │
└────────────────┘  └─────────────────┘
          │                 │
          └────────┬────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ src/caal/llm/providers/base.py (abstract interface)    │
│  - LLMProvider (ABC)                                     │
│  - LLMResponse, ToolCall (data classes)                 │
│  - Defines: chat(), chat_stream(), parse_tool_arguments() │
│  - Defines: format_tool_result(), format_tool_call_message() │
└─────────────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ src/caal/llm/llm_node.py (tool orchestration)          │
│  - llm_node(agent, chat_ctx, provider, ...) generator   │
│  - Calls provider.chat() for tool rounds                │
│  - Calls provider.chat_stream() for final response      │
│  - Provider-agnostic tool execution                      │
└─────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Abstract Base Class (base.py)

**Purpose:** Defines provider contract
**Location:** `src/caal/llm/providers/base.py`

**Required implementations:**
- `provider_name: str` - Identifier ("ollama", "groq", "openai", "openrouter")
- `model: str` - Model name for logging
- `chat(messages, tools, **kwargs) -> LLMResponse` - Non-streaming completion
- `chat_stream(messages, tools, **kwargs) -> AsyncIterator[str]` - Streaming response

**Optional overrides:**
- `supports_think: bool` - Whether provider supports thinking mode (default: False)
- `parse_tool_arguments(arguments) -> dict` - Parse tool args (default: expects dict)
- `format_tool_result(content, tool_call_id, tool_name) -> dict` - Format tool response (default: Ollama format)
- `format_tool_call_message(content, tool_calls) -> dict` - Format assistant message with tool calls (default: JSON string args)

**Key insight:** The base class provides sensible defaults. Groq overrides `parse_tool_arguments()` (JSON string → dict) and `format_tool_result()` (adds name field). OpenAI-compatible providers will likely need similar overrides.

### 2. Concrete Provider Implementation

**Pattern observed in existing providers:**

```python
class GroqProvider(LLMProvider):
    def __init__(self, model: str, api_key: str | None, temperature: float, max_tokens: int):
        self._model = model
        self._api_key = api_key or os.environ.get("GROQ_API_KEY")
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._client = AsyncGroq(api_key=self._api_key)

    @property
    def provider_name(self) -> str:
        return "groq"

    @property
    def model(self) -> str:
        return self._model

    async def chat(self, messages, tools, **kwargs) -> LLMResponse:
        # Provider-specific API call
        response = await self._client.chat.completions.create(...)
        # Normalize to LLMResponse
        return LLMResponse(content=..., tool_calls=...)

    async def chat_stream(self, messages, tools, **kwargs) -> AsyncIterator[str]:
        # Provider-specific streaming
        stream = await self._client.chat.completions.create(..., stream=True)
        async for chunk in stream:
            yield chunk.choices[0].delta.content
```

**Critical details:**
- API key from constructor param OR environment variable fallback
- Client initialization in `__init__`
- Async client for non-blocking operations
- Response normalization to `LLMResponse(content, tool_calls)`
- Tool calls parsed to `ToolCall(id, name, arguments)` dataclass

### 3. Factory Registration

**Location:** `src/caal/llm/providers/__init__.py`

**Current pattern:**
```python
def create_provider(provider_name: str, **kwargs) -> LLMProvider:
    provider_name = provider_name.lower()
    if provider_name == "ollama":
        return OllamaProvider(**kwargs)
    elif provider_name == "groq":
        return GroqProvider(**kwargs)
    else:
        raise ValueError(f"Unknown LLM provider: {provider_name}")
```

**Extension point:** Add new `elif` branches for "openai" and "openrouter".

### 4. Settings Integration

**Settings flow:**
```
settings.json → load_settings() → create_provider_from_settings() → provider instance
```

**Location:** `src/caal/llm/providers/__init__.py`

**Current pattern:**
```python
def create_provider_from_settings(settings: dict) -> LLMProvider:
    provider_name = settings.get("llm_provider", "ollama").lower()

    if provider_name == "ollama":
        return OllamaProvider(
            model=settings.get("ollama_model", "qwen3:8b"),
            base_url=settings.get("ollama_host"),
            think=settings.get("think", False),
            temperature=settings.get("temperature", 0.7),
            num_ctx=settings.get("num_ctx", 8192),
        )
    elif provider_name == "groq":
        api_key = settings.get("groq_api_key") or os.environ.get("GROQ_API_KEY")
        return GroqProvider(
            model=settings.get("groq_model", "llama-3.3-70b-versatile"),
            api_key=api_key,
            temperature=settings.get("temperature", 0.7),
        )
```

**Extension point:** Add `elif` branches that map settings keys to provider constructor params.

### 5. DEFAULT_SETTINGS Schema

**Location:** `src/caal/settings.py`

**Current structure:**
```python
DEFAULT_SETTINGS = {
    "llm_provider": "ollama",  # "ollama" | "groq" | "openai" | "openrouter"
    "temperature": 0.15,
    # Ollama-specific
    "ollama_host": "http://localhost:11434",
    "ollama_model": "ministral-3:8b",
    "num_ctx": 8192,
    # Groq-specific
    "groq_api_key": "",
    "groq_model": "llama-3.3-70b-versatile",
    # (New providers add their keys here)
}
```

**Extension point:** Add provider-specific keys like `openai_api_key`, `openai_model`, `openrouter_api_key`, `openrouter_model`.

### 6. Frontend Integration

**Settings Panel:** `frontend/components/settings/settings-panel.tsx`
- Reads settings from `/api/settings` endpoint
- Displays provider-specific fields conditionally
- Saves via POST to `/api/settings`

**Setup Wizard:** `frontend/components/setup/provider-step.tsx`
- Displays provider toggle (Ollama | Groq)
- Shows provider-specific connection form
- Tests connection via `/api/setup/test-{provider}` endpoint

**Extension points:**
- Add new provider buttons to toggle UI
- Add provider-specific form sections
- Frontend conditionally shows fields based on `settings.llm_provider`

### 7. Webhook Testing Endpoints

**Location:** `src/caal/webhooks.py`

**Current pattern:**
```python
@app.post("/setup/test-groq", response_model=TestConnectionResponse)
async def test_groq(req: TestGroqRequest):
    # Validate API key by calling provider's API
    response = await client.get(
        "https://api.groq.com/openai/v1/models",
        headers={"Authorization": f"Bearer {req.api_key}"},
    )
    if response.status_code == 401:
        return TestConnectionResponse(success=False, error="Invalid API key")
    # Return success + available models
    return TestConnectionResponse(success=True, models=[...])
```

**Extension point:** Add `/setup/test-openai` and `/setup/test-openrouter` endpoints.

## Data Flow: Settings → Provider → Agent

```
1. User edits settings in frontend
   ↓
2. Frontend POSTs to /api/settings
   ↓
3. Webhooks endpoint saves to settings.json
   ↓
4. Agent restart (manual or automatic)
   ↓
5. voice_agent.py loads settings via load_settings()
   ↓
6. CAALLLM.from_settings(settings)
   ↓
7. create_provider_from_settings(settings)
   ↓
8. OllamaProvider(**kwargs) OR GroqProvider(**kwargs) OR ...
   ↓
9. CAALLLM wraps provider, passed to VoiceAssistant
   ↓
10. VoiceAssistant.llm_node() calls llm_node(provider=self._provider)
    ↓
11. llm_node() calls provider.chat() and provider.chat_stream()
```

**Critical insight:** Settings changes require agent restart. The provider instance is created once at startup, not dynamically reloaded mid-session.

## Files to Create

### New Provider Implementations

1. **`src/caal/llm/providers/openai_provider.py`**
   - `OpenAIProvider(LLMProvider)` class
   - Constructor: `model`, `api_key`, `base_url`, `temperature`, `max_tokens`
   - Client: `AsyncOpenAI(api_key=..., base_url=...)`
   - Override `format_tool_result()` if OpenAI has specific requirements (likely similar to Groq)

2. **`src/caal/llm/providers/openrouter_provider.py`**
   - `OpenRouterProvider(LLMProvider)` class
   - Constructor: `model`, `api_key`, `temperature`, `max_tokens`
   - Client: `AsyncOpenAI(api_key=..., base_url="https://openrouter.ai/api/v1")`
   - May need to override `parse_tool_arguments()` depending on OpenRouter's response format

## Files to Modify

### Backend (Python)

1. **`src/caal/llm/providers/__init__.py`**
   - **Add imports:** `from .openai_provider import OpenAIProvider`, `from .openrouter_provider import OpenRouterProvider`
   - **Add to `__all__`:** `"OpenAIProvider"`, `"OpenRouterProvider"`
   - **Extend `create_provider()`:** Add `elif provider_name == "openai"` and `elif provider_name == "openrouter"` branches
   - **Extend `create_provider_from_settings()`:** Map settings keys to provider constructors

2. **`src/caal/settings.py`**
   - **Add to `DEFAULT_SETTINGS`:**
     ```python
     # OpenAI settings
     "openai_api_key": "",
     "openai_base_url": "https://api.openai.com/v1",  # Allow custom endpoints
     "openai_model": "gpt-4o-mini",
     # OpenRouter settings
     "openrouter_api_key": "",
     "openrouter_model": "openai/gpt-4o-mini",
     ```

3. **`src/caal/webhooks.py`**
   - **Add Pydantic request models:**
     ```python
     class TestOpenAIRequest(BaseModel):
         api_key: str
         base_url: str = "https://api.openai.com/v1"

     class TestOpenRouterRequest(BaseModel):
         api_key: str
     ```
   - **Add test endpoints:**
     ```python
     @app.post("/setup/test-openai", response_model=TestConnectionResponse)
     async def test_openai(req: TestOpenAIRequest):
         # Call https://api.openai.com/v1/models with Authorization header
         # Return success + models list

     @app.post("/setup/test-openrouter", response_model=TestConnectionResponse)
     async def test_openrouter(req: TestOpenRouterRequest):
         # Call https://openrouter.ai/api/v1/models
         # Return success + models list
     ```

### Frontend (TypeScript)

4. **`frontend/components/setup/provider-step.tsx`**
   - **Extend provider toggle:** Change from 2-column grid to 4-column grid or dropdown
   - **Add state:** `openaiModels`, `openrouterModels`, `openaiTest`, `openrouterTest`
   - **Add test functions:** `testOpenAI()`, `testOpenRouter()`
   - **Add form sections:** Conditional rendering for OpenAI (api_key + base_url) and OpenRouter (api_key)
   - **Model selection:** Dropdowns populated from test response

5. **`frontend/components/settings/settings-panel.tsx`**
   - **Extend Settings interface:**
     ```typescript
     interface Settings {
       llm_provider: 'ollama' | 'groq' | 'openai' | 'openrouter';
       openai_api_key: string;
       openai_base_url: string;
       openai_model: string;
       openrouter_api_key: string;
       openrouter_model: string;
       // ... existing fields
     }
     ```
   - **Add to DEFAULT_SETTINGS:** OpenAI/OpenRouter defaults
   - **Add conditional rendering:** Provider-specific forms in Providers tab
   - **Add test logic:** Similar to existing Ollama/Groq tests

## Suggested Build Order

### Phase 1: Backend Foundation (No Breaking Changes)

**Goal:** Add provider implementations without touching UI or settings schema yet.

1. **Create `openai_provider.py`**
   - Implement `OpenAIProvider` class
   - Test with hardcoded API key in Python REPL
   - Verify tool calling works with simple tools

2. **Create `openrouter_provider.py`**
   - Implement `OpenRouterProvider` class
   - Test with hardcoded API key
   - Verify model list fetching works

3. **Update `providers/__init__.py`**
   - Add imports and `__all__` entries
   - Extend `create_provider()` factory
   - DO NOT modify `create_provider_from_settings()` yet (no settings schema)

**Validation:** Can instantiate providers manually with `create_provider("openai", api_key="...")`.

### Phase 2: Settings Integration (Breaking Change - Requires Migration)

**Goal:** Add settings keys and factory logic.

4. **Update `settings.py`**
   - Add OpenAI/OpenRouter keys to `DEFAULT_SETTINGS`
   - No migration needed (new keys auto-populate with defaults)

5. **Update `providers/__init__.py`**
   - Extend `create_provider_from_settings()` with new provider branches
   - Map settings keys to constructor params

**Validation:** Can set `"llm_provider": "openai"` in settings.json and agent starts successfully.

### Phase 3: Connection Testing Endpoints

**Goal:** Enable setup wizard to validate API keys.

6. **Update `webhooks.py`**
   - Add Pydantic request models
   - Add `/setup/test-openai` endpoint
   - Add `/setup/test-openrouter` endpoint

**Validation:** `curl -X POST http://localhost:8889/setup/test-openai -d '{"api_key":"sk-..."}'` returns success.

### Phase 4: Frontend Setup Wizard

**Goal:** Allow first-launch configuration of new providers.

7. **Update `provider-step.tsx`**
   - Extend provider toggle UI (4 buttons or dropdown)
   - Add OpenAI/OpenRouter form sections
   - Add test logic
   - Add model selection dropdowns

**Validation:** Setup wizard displays OpenAI/OpenRouter options, connection test works.

### Phase 5: Frontend Settings Panel

**Goal:** Allow runtime provider switching via settings.

8. **Update `settings-panel.tsx`**
   - Extend Settings interface
   - Add OpenAI/OpenRouter forms to Providers tab
   - Add connection test buttons
   - Add model dropdowns

**Validation:** Can switch provider in settings, save, restart agent, verify new provider is used.

## Component Dependencies

```
Phase 1 (Backend Foundation)
├─ openai_provider.py (NEW, standalone)
├─ openrouter_provider.py (NEW, standalone)
└─ providers/__init__.py (MODIFY, depends on above)

Phase 2 (Settings Integration)
├─ settings.py (MODIFY, no dependencies)
└─ providers/__init__.py (MODIFY, depends on settings.py)

Phase 3 (Testing Endpoints)
└─ webhooks.py (MODIFY, depends on provider implementations)

Phase 4 (Setup Wizard)
└─ provider-step.tsx (MODIFY, depends on webhooks.py)

Phase 5 (Settings Panel)
└─ settings-panel.tsx (MODIFY, depends on webhooks.py)
```

**Build order rationale:**
- Backend before frontend (providers must exist before UI can configure them)
- Settings schema before UI (UI reads/writes settings keys)
- Testing endpoints before UI (UI calls test endpoints)
- Setup wizard before settings panel (wizard is first-launch, panel is ongoing management)

## Architecture Strengths

1. **Clean separation of concerns:** Provider logic isolated from agent pipeline
2. **Provider-agnostic tool execution:** `llm_node()` works with any provider via abstract interface
3. **Sensible defaults in base class:** Reduces boilerplate for standard OpenAI-compatible APIs
4. **Settings-driven configuration:** No code changes needed to switch providers
5. **Factory pattern:** Easy to add new providers without modifying existing ones

## Architecture Considerations

1. **API key storage:** Currently stored in `settings.json` (plaintext). For production, consider environment variables or secrets management.
2. **Provider restart requirement:** Changing providers requires agent restart. Not hot-swappable mid-session.
3. **Model availability:** Setup wizard fetches available models from provider APIs. OpenRouter has 100+ models - may need filtering/search UI.
4. **Rate limiting:** OpenRouter and some OpenAI-compatible providers have rate limits. Consider adding retry logic with exponential backoff.
5. **Base URL flexibility:** OpenAI-compatible providers (e.g., Azure OpenAI, local vLLM) need custom base URLs. OpenAI provider should accept `base_url` parameter.

## OpenAI-Compatible Provider Pattern

Most providers follow the OpenAI API spec. Key observations:

**Similarities (can reuse code):**
- Same request/response format for chat completions
- Same tool calling format (function calling)
- Same streaming format (SSE with `data:` prefix)

**Differences (provider-specific):**
- **Base URL:** OpenRouter uses `https://openrouter.ai/api/v1`, local vLLM uses custom URLs
- **Authentication:** OpenRouter uses `X-Title` header for app attribution, some providers use custom auth
- **Model namespacing:** OpenRouter uses `provider/model` format (e.g., `openai/gpt-4o-mini`)
- **Rate limits:** Vary by provider

**Recommendation:** Implement `OpenAIProvider` first (reference implementation), then `OpenRouterProvider` (inherits from `OpenAIProvider` or reuses logic).

## Sources

All findings based on direct code inspection:
- `src/caal/llm/providers/base.py` - Abstract interface definition
- `src/caal/llm/providers/ollama_provider.py` - Ollama implementation pattern
- `src/caal/llm/providers/groq_provider.py` - Groq implementation pattern
- `src/caal/llm/providers/__init__.py` - Factory functions
- `src/caal/llm/caal_llm.py` - LiveKit LLM wrapper
- `src/caal/llm/llm_node.py` - Provider consumption in agent pipeline
- `src/caal/settings.py` - Settings schema and loading
- `src/caal/webhooks.py` - API endpoints for setup/settings
- `voice_agent.py` - Agent initialization and provider instantiation
- `frontend/components/setup/provider-step.tsx` - Setup wizard UI
- `frontend/components/settings/settings-panel.tsx` - Settings UI

**Confidence assessment:** HIGH - All integration points identified from actual codebase inspection.

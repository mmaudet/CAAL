# Pitfalls Research: LLM Providers (OpenAI-Compatible & OpenRouter)

**Project:** CAAL Voice Assistant
**Researched:** 2026-02-05
**Confidence:** HIGH

## Summary

Adding OpenAI-compatible and OpenRouter providers to an existing voice assistant with working Ollama/Groq providers introduces specific pitfalls around API compatibility assumptions, tool calling format variations, streaming behavior, and connection testing. The existing CAAL codebase has a strong provider abstraction (`LLMProvider` base class) and settings management system, but integration mistakes can cause silent failures, inconsistent behavior, and production debugging nightmares.

**Key Finding:** The most critical pitfall is assuming OpenAI compatibility means "drop-in replacement" - tool calling formats, streaming behavior, authentication patterns, and model discovery APIs all have provider-specific quirks that must be handled explicitly.

## Critical Pitfalls

Mistakes that cause rewrites, silent failures, or major issues.

### Pitfall 1: Streaming Tool Call Format Mismatch

**What goes wrong:** When tools are defined in streaming mode, some OpenAI-compatible providers send tool call deltas instead of content deltas, producing zero text output and a silent session (user speaks, agent says nothing).

**Why it happens:** CAAL's existing `GroqProvider.chat_stream()` sets `tool_choice="none"` to prevent tool calls during streaming (lines 165-171 in `groq_provider.py`). This is because streaming is used for text responses only, while non-streaming `chat()` handles tool execution. New providers may not respect this pattern, or may require different parameters.

**Consequences:**
- User interaction appears broken (agent is "silent")
- No error logs - the API call succeeds but returns wrong data type
- Difficult to debug because it works in testing with simple prompts (no tools)
- Only manifests when tools are registered (Home Assistant, n8n)

**Prevention:**
1. Always set `tool_choice="none"` in streaming mode if tools are provided
2. Test streaming with tools registered, not just simple prompts
3. Verify delta chunks contain `content` field, not `tool_calls` field
4. Add logging to detect empty content streams: `if not chunk.choices[0].delta.content: logger.warning(...)`

**Detection:** Warning signs include:
- Connection test passes but agent is silent during conversation
- `chat()` works but `chat_stream()` produces no output
- Agent responds to first message but not subsequent ones (tool history accumulates)

**Phase:** Backend Provider Implementation (Phase 1)

### Pitfall 2: Tool Call Arguments Format Inconsistency

**What goes wrong:** OpenAI-compatible providers differ in whether they return tool call arguments as JSON string or dict. Assuming one format causes JSON parsing errors or type mismatches.

**Why it happens:**
- Ollama returns arguments as `dict` (line 143 in `ollama_provider.py`)
- Groq returns arguments as JSON `string` (lines 179-199 in `groq_provider.py`)
- OpenAI-compatible providers vary: some mimic OpenAI (string), others mimic Ollama (dict)
- LM Studio, LocalAI, vLLM each have subtle differences

**Consequences:**
- Tool execution fails with `TypeError: string indices must be integers`
- Or `json.JSONDecodeError` when trying to parse an already-parsed dict
- Intermittent failures depending on which model/provider is used
- Tools appear "unavailable" even though they're registered

**Prevention:**
1. Implement robust `parse_tool_arguments()` for each provider
2. Handle both string and dict inputs gracefully (type check first)
3. Log the raw argument type/value before parsing
4. Test with actual tool calls, not just tool registration

**Code pattern to follow:**
```python
def parse_tool_arguments(self, arguments: Any) -> dict[str, Any]:
    if isinstance(arguments, str):
        try:
            return json.loads(arguments)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse tool arguments: {arguments}")
            return {}
    if isinstance(arguments, dict):
        return arguments
    return {}
```

**Detection:** Warning signs include:
- Tool calls trigger but execution fails
- Error logs show type errors in tool execution
- Works with one provider but not another

**Phase:** Backend Provider Implementation (Phase 1)

### Pitfall 3: Tool Result Message Format Differences

**What goes wrong:** Tool result messages require different fields for different providers. Missing fields cause conversation context corruption.

**Why it happens:**
- Ollama only requires: `{"role": "tool", "content": "...", "tool_call_id": "..."}`
- Groq additionally requires: `"name": tool_name` field (line 219-224 in `groq_provider.py`)
- OpenAI-compatible providers may require yet other fields
- CAAL's `llm_node.py` relies on `format_tool_result()` to handle this

**Consequences:**
- Tool executes successfully but LLM doesn't receive result
- "Assistant message must be followed by user message" API errors
- Conversation history becomes malformed, breaking subsequent turns
- Agent repeats tool calls or loses context

**Prevention:**
1. Override `format_tool_result()` for each provider based on their API docs
2. Test multi-turn conversations with tool execution
3. Log full message history after tool execution
4. Verify provider accepts the message format with a validation test

**Detection:** Warning signs include:
- First tool call works, subsequent turns fail
- API errors mentioning "message role" or "invalid message format"
- Agent forgets previous tool results

**Phase:** Backend Provider Implementation (Phase 1)

### Pitfall 4: Base URL and Authentication Header Confusion

**What goes wrong:** OpenAI-compatible providers use different base URLs and authentication patterns. Mixing them causes 401/404 errors.

**Why it happens:**
- OpenAI official: `https://api.openai.com/v1/` with `Authorization: Bearer $key`
- LM Studio: `http://localhost:1234/v1/` (no auth, or optional)
- vLLM: Custom URL with optional API key
- OpenRouter: `https://openrouter.ai/api/v1/` with `Authorization: Bearer $key`
- LocalAI: Custom URL, may use API key or no auth

Common mistakes:
- Hardcoding `/v1/` suffix (some providers expect it, others don't)
- Assuming API key is always required
- Not stripping trailing slashes from base URL
- Copying OpenAI client initialization without customizing base_url

**Consequences:**
- Connection test fails with "Not Found" (404) or "Unauthorized" (401)
- Works on localhost but fails in Docker (different URLs)
- Credentials work but requests go to wrong endpoint

**Prevention:**
1. Make base URL fully configurable (don't append `/v1/` automatically)
2. Make API key optional (some local providers don't need it)
3. Normalize URLs: strip trailing slashes, validate format
4. Document expected URL format in settings UI placeholders
5. Test connection with actual API call, not just URL validation

**Settings structure:**
```python
# For OpenAI-compatible provider
"openai_compat_base_url": "http://localhost:1234/v1",  # Full URL
"openai_compat_api_key": "",  # Optional
# For OpenRouter
"openrouter_api_key": "",  # Required
```

**Detection:** Warning signs include:
- Connection test returns 404 or 401
- Works with `curl` but not with provider
- Different behavior between development and Docker

**Phase:** Backend Provider Implementation (Phase 1), Connection Testing (Phase 3)

## OpenAI-Compatible Provider Pitfalls

Specific issues for LM Studio, vLLM, LocalAI, and similar.

### Pitfall 5: Partial Tool API Implementation

**What goes wrong:** Not all OpenAI-compatible servers fully implement the tools API. Some only support legacy function calling, others have experimental tool support.

**Why it happens:**
- LM Studio's tool calling is "experimental" (v0.2.9+), may have edge cases
- Some vLLM versions don't support `tool_choice` parameter
- LocalAI tool support depends on backend (llama.cpp vs vLLM vs transformers)
- Providers may silently ignore tools parameter and respond without using them

**Consequences:**
- Tools appear registered but never get called
- Agent tries to answer questions it should delegate to tools
- Inconsistent behavior: works with some models, not others
- No clear error message - tools are just silently ignored

**Prevention:**
1. Document minimum provider versions for tool support (LM Studio v0.2.9+)
2. Add capability detection: test if provider supports tools during connection test
3. Gracefully degrade: if tools not supported, disable tool features but keep basic chat
4. Show warning in UI: "This provider may not support tool calling"

**Capability detection approach:**
```python
async def supports_tools(self) -> bool:
    """Test if provider supports tool calling."""
    try:
        response = await self.chat(
            messages=[{"role": "user", "content": "test"}],
            tools=[{"type": "function", "function": {"name": "test", ...}}]
        )
        # If API accepts tools without error, assume support
        return True
    except Exception as e:
        if "tools" in str(e).lower():
            return False
        raise
```

**Detection:** Warning signs include:
- Connection test passes but tools never trigger
- Agent responds with "I don't have access to..." for tool-backed features
- Works with Ollama/Groq but not with OpenAI-compatible provider

**Phase:** Backend Provider Implementation (Phase 1), Connection Testing (Phase 3)

### Pitfall 6: Model Discovery API Inconsistency

**What goes wrong:** OpenAI-compatible providers use different endpoints and response formats for listing models. Code that works for Ollama (`/api/tags`) fails for others.

**Why it happens:**
- Ollama: `GET /api/tags` returns `{"models": [{"name": "..."}]}`
- OpenAI: `GET /v1/models` returns `{"data": [{"id": "..."}]}`
- LM Studio: May not have models endpoint (loads from disk)
- vLLM: `GET /v1/models` but may return only loaded model
- LocalAI: `GET /v1/models` but format varies by backend

CAAL's existing `/models` endpoint (lines 716-742 in `webhooks.py`) only queries Ollama format.

**Consequences:**
- Model dropdown in settings UI shows "No models available"
- User has to manually type model name
- Connection test passes but model selection fails
- Poor UX compared to Ollama's auto-discovery

**Prevention:**
1. Create provider-specific model discovery methods
2. For OpenAI-compatible, try OpenAI format first: `GET /v1/models` with `{"data": [...]}` response
3. If models endpoint fails, allow manual model entry
4. Cache discovered models (don't refetch on every settings page load)
5. Show provider-specific placeholder text: "e.g., hermes-2-pro-mistral for LM Studio"

**Implementation note:**
```python
# webhooks.py needs:
@app.get("/models")
async def get_models(provider: str | None = None):
    settings = settings_module.load_settings()
    provider = provider or settings.get("llm_provider", "ollama")

    if provider == "ollama":
        # Existing Ollama implementation
    elif provider == "openai_compat":
        # Try OpenAI format
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/v1/models")
            data = response.json()
            return {"models": [m["id"] for m in data.get("data", [])]}
    # ...
```

**Detection:** Warning signs include:
- Settings UI shows empty model dropdown
- 404 errors when fetching models
- Works manually but not in UI

**Phase:** UI Integration (Phase 2), Model Discovery (Phase 4)

### Pitfall 7: Context Window Size Misconfiguration

**What goes wrong:** OpenAI-compatible providers handle `num_ctx`/`max_tokens` differently. Exceeding limits causes cryptic errors or truncated responses.

**Why it happens:**
- Ollama uses `num_ctx` in options dict (line 100 in `ollama_provider.py`)
- OpenAI uses `max_tokens` in request body (for response length, not context)
- Some providers use `max_model_len` or `context_length`
- Voice assistants accumulate large message histories (tools + conversations)

**Consequences:**
- "Context length exceeded" errors after several turns
- Tool calls stop working mid-conversation
- Responses get truncated without warning
- Different models have different limits (8k vs 32k vs 128k)

**Prevention:**
1. Document context limits per provider/model
2. Implement sliding window in `llm_node.py` (CAAL already has this for Ollama)
3. Don't hardcode `num_ctx` - make it model-specific
4. For OpenAI-compatible, distinguish between context window (input) and max_tokens (output)
5. Log warning when approaching context limit

**Configuration approach:**
```python
# settings.py
"openai_compat_max_tokens": 4096,  # Output length
# Context window handled by sliding window, not static config
```

**Detection:** Warning signs include:
- Works initially, fails after 5-10 conversation turns
- Errors mentioning "context" or "tokens"
- Tool history causes failures

**Phase:** Backend Provider Implementation (Phase 1)

## OpenRouter Provider Pitfalls

Specific issues for OpenRouter cloud aggregator.

### Pitfall 8: Latency and the "Hop Tax"

**What goes wrong:** OpenRouter adds 200-500ms latency per request because it proxies through aggregation layer. For real-time voice assistants, this is a dealbreaker.

**Why it happens:**
- Every request goes: CAAL → OpenRouter → Actual Provider → OpenRouter → CAAL
- Network hop overhead + provider selection decision time
- Voice assistant users expect sub-second response times (TTFB < 500ms)
- Streaming helps but still has noticeable delay

**Consequences:**
- Conversation feels sluggish compared to direct Groq/Ollama
- User starts speaking before agent finishes (interruptions increase)
- Poor UX for time-sensitive queries ("set a timer for 5 minutes")
- Compounds with STT and TTS latency

**Prevention:**
1. Warn users about latency in provider description: "Note: OpenRouter adds network latency"
2. Measure and display actual latency in connection test
3. Consider OpenRouter a fallback option, not primary choice
4. Document when to use: "Good for model variety, not for low-latency voice"

**Latency testing in connection test:**
```python
import time
start = time.time()
response = await client.post(url, json=request)
latency_ms = (time.time() - start) * 1000
if latency_ms > 1000:
    return {"success": True, "warning": f"High latency detected: {latency_ms:.0f}ms"}
```

**Detection:** Warning signs include:
- Connection test succeeds but conversation feels slow
- Noticeable pause between user speech and agent response
- Better experience with Groq despite using same model

**Phase:** Provider Selection (Design), Connection Testing (Phase 3)

### Pitfall 9: Unpredictable Provider Routing

**What goes wrong:** OpenRouter routes to different providers (Fireworks, DeepInfra, Lepton) based on cost/availability. Same model name produces inconsistent behavior, making debugging impossible.

**Why it happens:**
- OpenRouter's routing algorithm prioritizes: uptime → cost → availability
- "llama-3-70b" might go to 5 different backends in one hour
- Different providers use different quantizations, serving configurations
- No visibility into which backend handled which request

**Consequences:**
- Tool calling works sometimes, fails other times (different providers have different tool support)
- Response quality varies (quantization differences)
- Can't reproduce bugs reliably ("it worked 10 minutes ago!")
- Production debugging nightmare: logs show OpenRouter, not actual provider

**Prevention:**
1. Document this limitation prominently: "OpenRouter routes dynamically - behavior may vary"
2. For production voice assistants, recommend direct provider connections (Groq, OpenAI) over OpenRouter
3. If using OpenRouter, use Exacto variants for tool calling consistency
4. Log OpenRouter's response headers (include provider info if available)
5. Test thoroughly with multiple requests, not just one successful test

**Code consideration:**
```python
# Log provider routing info
if "x-openrouter-provider" in response.headers:
    logger.info(f"Request routed to: {response.headers['x-openrouter-provider']}")
```

**Detection:** Warning signs include:
- Tests pass but production has intermittent failures
- Same query works/fails randomly
- Can't reproduce issues consistently

**Phase:** Provider Selection (Design), Backend Provider Implementation (Phase 1)

### Pitfall 10: Model Discovery Returns 400+ Models

**What goes wrong:** OpenRouter's `/v1/models` endpoint returns 400+ models. Showing all in dropdown creates terrible UX.

**Why it happens:**
- OpenRouter aggregates models from 20+ providers
- Each model x provider combination = separate listing
- Many models are deprecated or experimental
- No clear way to filter "good for voice assistants"

**Consequences:**
- Settings UI becomes unusable (huge dropdown, slow to load)
- User overwhelmed: which of 400 models should they choose?
- Many models don't support features CAAL needs (tool calling, streaming)
- Poor first-time user experience

**Prevention:**
1. Implement curated model list for OpenRouter (whitelist approach)
2. Filter by capabilities: `supports_tools=true` and `supports_streaming=true`
3. Categorize models: "Recommended for Voice", "All Models" (collapsed by default)
4. Show model metadata: cost, latency, context window
5. Default to known-good model: `meta-llama/llama-3.1-70b-instruct`

**UI approach:**
```tsx
// Curated list for OpenRouter
const RECOMMENDED_OPENROUTER_MODELS = [
  "meta-llama/llama-3.1-70b-instruct",
  "anthropic/claude-3.5-sonnet",
  "google/gemini-pro-1.5",
  // Only 5-10 known-good models
]

// Allow advanced users to enter custom model ID
<input placeholder="Or enter any OpenRouter model ID" />
```

**Detection:** Warning signs include:
- Model dropdown takes 10+ seconds to load
- UI freezes when opening model selector
- User confusion about which model to choose

**Phase:** UI Integration (Phase 2), Model Discovery (Phase 4)

### Pitfall 11: Auto-Model Selection Unpredictability

**What goes wrong:** OpenRouter's "auto" model routing picks different models based on availability/cost. Quality varies day-to-day.

**Why it happens:**
- "openrouter/auto" doesn't lock to specific model
- Selection algorithm considers: task type, cost, latency, availability
- Today's auto might be GPT-4, tomorrow's might be Claude, next day Llama
- Different models have different capabilities (tool calling, context windows, instruction following)

**Consequences:**
- Voice assistant behavior changes without code changes
- Tool calling stops working (switched to model without tool support)
- Conversation quality degrades (switched to weaker model)
- Costs fluctuate unexpectedly

**Prevention:**
1. Don't expose "auto" option in CAAL settings UI
2. Force explicit model selection
3. If supporting auto, show prominent warning: "Model will change automatically - not recommended for production"
4. Document in setup wizard: "Choose a specific model for consistent behavior"

**Phase:** UI Integration (Phase 2)

## Integration Pitfalls

Issues when adding to existing CAAL system.

### Pitfall 12: Provider Switching Without Restart

**What goes wrong:** CAAL's provider is instantiated at agent startup. Changing settings doesn't switch provider until restart.

**Why it happens:**
- `voice_agent.py` loads settings once at startup
- Provider instance (`OllamaProvider`, `GroqProvider`) is created in `entrypoint()`
- Settings changes update JSON file but don't reload running agent
- LiveKit agent keeps using old provider instance

**Consequences:**
- User changes from Ollama to OpenAI-compatible in settings
- Clicks "Save" and expects immediate effect
- Agent still uses Ollama - appears broken
- No feedback that restart is required

**Prevention:**
1. Show restart prompt in UI after provider change: "Restart required for provider change"
2. Add "Restart Agent" button in settings panel
3. Document in settings: "Provider changes require agent restart"
4. Consider hot-reload mechanism (complex, may not be worth it for MVP)

**UI pattern:**
```tsx
if (changedFields.includes('llm_provider')) {
  showNotification({
    type: 'warning',
    message: 'Provider changed. Restart agent for changes to take effect.',
    action: { label: 'Restart Now', onClick: restartAgent }
  })
}
```

**Detection:** Warning signs include:
- Settings save succeeds but behavior doesn't change
- Connection test shows new provider works but agent uses old one
- Requires manual Docker restart

**Phase:** UI Integration (Phase 2)

### Pitfall 13: STT/LLM Provider Coupling Assumption

**What goes wrong:** CAAL currently couples STT and LLM providers (Ollama→Speaches, Groq→Groq, see line 453 in `webhooks.py`). New providers break this assumption.

**Why it happens:**
- Existing logic: Groq provides both STT and LLM
- Ollama only provides LLM, so STT falls back to Speaches
- OpenAI-compatible providers: usually only LLM
- OpenRouter: only LLM

**Consequences:**
- User selects OpenRouter for LLM
- Code tries to use OpenRouter for STT (which doesn't exist)
- STT fails, agent can't hear user
- Error: "OpenRouter does not support transcription endpoint"

**Prevention:**
1. Decouple STT and LLM provider selection in settings
2. Show separate dropdowns: "Speech-to-Text Provider" and "LLM Provider"
3. For OpenAI-compatible/OpenRouter, auto-select Speaches or Groq for STT
4. Document compatibility matrix in UI

**Settings structure:**
```python
# Decoupled providers
"stt_provider": "speaches",  # or "groq"
"llm_provider": "openai_compat",  # independent choice
```

**Enforce coupling in backend:**
```python
# voice_agent.py
stt_provider = settings["stt_provider"]
llm_provider = settings["llm_provider"]

# If OpenRouter/OpenAI-compatible selected, STT must be Speaches or Groq
if llm_provider in ["openrouter", "openai_compat"]:
    if stt_provider not in ["speaches", "groq"]:
        stt_provider = "speaches"  # Fallback
        logger.warning(f"Overriding STT to {stt_provider} for {llm_provider}")
```

**Detection:** Warning signs include:
- Connection test passes but agent doesn't respond to voice
- STT errors in logs after switching providers
- Works with text input but not voice

**Phase:** Backend Provider Implementation (Phase 1), UI Integration (Phase 2)

### Pitfall 14: Settings Schema Migration

**What goes wrong:** Adding new provider settings breaks existing installations that don't have those keys in `settings.json`.

**Why it happens:**
- `settings.py` uses `DEFAULT_SETTINGS` as fallback (lines 32-77)
- New providers add keys: `openai_compat_base_url`, `openrouter_api_key`, etc.
- Old installations have `settings.json` without these keys
- Code tries to access keys that don't exist

**Consequences:**
- Existing users upgrade and agent won't start
- KeyError or AttributeError in provider initialization
- Settings UI shows undefined values
- Requires manual editing of `settings.json`

**Prevention:**
1. Always add new keys to `DEFAULT_SETTINGS` first
2. Use `.get()` with defaults when accessing settings
3. Implement settings migration in `load_settings()`
4. Test upgrade path: install old version, upgrade, verify works

**Migration pattern (in `settings.py`):**
```python
def _migrate_settings(settings: dict) -> dict:
    """Migrate old settings format to current schema."""
    # Add new provider keys if missing
    if "openai_compat_base_url" not in settings:
        settings["openai_compat_base_url"] = ""
    if "openrouter_api_key" not in settings:
        settings["openrouter_api_key"] = ""
    # ... etc
    return settings
```

**Detection:** Warning signs include:
- Logs show KeyError or AttributeError
- Settings UI fails to load
- Fresh install works but upgrade fails

**Phase:** Settings Management (Phase 1)

### Pitfall 15: Connection Test False Positives

**What goes wrong:** Connection test succeeds but actual agent usage fails because test doesn't validate full feature set.

**Why it happens:**
- Current tests (lines 1029-1088 in `webhooks.py`) only verify:
  - Can connect to endpoint
  - Authentication works
  - Models endpoint returns data
- They don't test:
  - Streaming with tools
  - Tool call format compatibility
  - Context window limits
  - Model-specific features

**Consequences:**
- User completes setup wizard successfully
- First conversation fails with tool calling error
- "But the test passed!" - user confusion
- Poor first-run experience

**Prevention:**
1. Expand connection tests to validate actual usage patterns
2. Test streaming with sample message
3. Test tool calling with mock tool
4. Show detailed test results: "Streaming: ✓, Tool Calling: ✓, Models: ✓"
5. Surface warnings: "Tool calling not supported" or "Streaming may be slow"

**Comprehensive test pattern:**
```python
@app.post("/setup/test-openai-compat")
async def test_openai_compat(req: TestOpenAICompatRequest):
    results = {
        "connection": False,
        "streaming": False,
        "tool_calling": False,
        "models": []
    }

    # Test 1: Basic connection
    try:
        response = await client.get(f"{req.base_url}/v1/models")
        results["connection"] = True
        results["models"] = parse_models(response.json())
    except Exception as e:
        return {"success": False, "error": str(e)}

    # Test 2: Streaming
    try:
        stream = await client.post(f"{req.base_url}/v1/chat/completions", json={
            "model": results["models"][0],
            "messages": [{"role": "user", "content": "Hi"}],
            "stream": True
        })
        # Verify we get chunks
        chunk_count = 0
        async for chunk in stream:
            chunk_count += 1
            if chunk_count > 3: break
        results["streaming"] = chunk_count > 0
    except:
        results["streaming"] = False

    # Test 3: Tool calling
    try:
        response = await client.post(f"{req.base_url}/v1/chat/completions", json={
            "model": results["models"][0],
            "messages": [{"role": "user", "content": "What's the weather?"}],
            "tools": [{"type": "function", "function": {"name": "get_weather", ...}}]
        })
        # Check if tools parameter was accepted (not rejected)
        results["tool_calling"] = True
    except:
        results["tool_calling"] = False

    return {
        "success": True,
        "details": results,
        "warnings": generate_warnings(results)
    }
```

**Detection:** Warning signs include:
- Setup wizard succeeds but conversation fails
- Different error than during connection test
- Works in test but not in actual usage

**Phase:** Connection Testing (Phase 3)

## Prevention Strategies Summary

Ranked by impact on preventing mistakes.

### Strategy 1: Comprehensive Connection Testing (Prevents Pitfalls 4, 5, 15)

**What:** Expand test endpoints to validate full feature set, not just connectivity.

**Implementation:**
- Test streaming with sample messages
- Test tool calling with mock tool definitions
- Measure and display latency
- Show detailed results per feature
- Surface warnings for unsupported features

**Files to modify:**
- `webhooks.py` (connection test endpoints)

**Validation:**
- Test passes → agent actually works
- Test warnings → user informed of limitations

### Strategy 2: Explicit Format Handling (Prevents Pitfalls 1, 2, 3)

**What:** Never assume OpenAI compatibility means identical behavior. Handle each format explicitly.

**Implementation:**
- Override `parse_tool_arguments()` for each provider
- Override `format_tool_result()` for each provider
- Override `format_tool_call_message()` if needed
- Always set `tool_choice="none"` in streaming mode
- Log raw formats for debugging

**Files to modify:**
- `src/caal/llm/providers/openai_compat_provider.py` (new file)
- `src/caal/llm/providers/openrouter_provider.py` (new file)

**Validation:**
- Tool calls execute successfully
- Multi-turn conversations maintain context
- No type errors in tool execution

### Strategy 3: Provider-Specific Model Discovery (Prevents Pitfalls 6, 10)

**What:** Handle model listing per provider, with fallback to manual entry.

**Implementation:**
- Create provider-specific model fetching logic
- Curate recommended model lists for OpenRouter
- Allow manual model ID entry as fallback
- Cache model lists (don't refetch constantly)
- Show helpful placeholders: "e.g., hermes-2-pro for LM Studio"

**Files to modify:**
- `webhooks.py` (`/models` endpoint - add provider parameter)
- Settings UI (model dropdown with provider awareness)

**Validation:**
- Model dropdown populates correctly per provider
- Manual entry works when API unavailable
- Recommended models shown first

### Strategy 4: Decoupled Provider Settings (Prevents Pitfall 13)

**What:** Separate STT and LLM provider selection, with smart defaults.

**Implementation:**
- Add separate `stt_provider` and `llm_provider` settings
- UI shows both dropdowns (or coupled radio if keeping coupling)
- Backend enforces compatibility: OpenRouter/OpenAI-compat → must use Speaches/Groq for STT
- Document compatibility matrix

**Files to modify:**
- `settings.py` (add new keys, maintain backwards compat)
- `voice_agent.py` (decouple provider initialization)
- Settings UI (separate or coupled selection)

**Validation:**
- Can select any valid provider combination
- Invalid combinations prevented or warned
- Existing installations migrate smoothly

### Strategy 5: Settings Schema Versioning (Prevents Pitfall 14)

**What:** Implement proper settings migration for schema changes.

**Implementation:**
- Add `settings_version` to `DEFAULT_SETTINGS`
- Implement `_migrate_settings()` function
- Always use `.get()` with defaults when accessing settings
- Test upgrade paths (old settings.json → new schema)

**Files to modify:**
- `settings.py` (add migration logic)

**Validation:**
- Fresh install works
- Upgrade from previous version works
- No KeyError or AttributeError

### Strategy 6: Capability Detection and Graceful Degradation (Prevents Pitfall 5)

**What:** Detect what features each provider supports, degrade gracefully if unsupported.

**Implementation:**
- Add `supports_tools()` method to provider base class
- Test tool support during connection test
- Show warnings in UI: "Tool calling may not be supported"
- Disable tool-dependent features if unsupported
- Document minimum versions (LM Studio v0.2.9+)

**Files to modify:**
- `base.py` (add capability methods)
- Each provider implementation
- Connection test endpoints

**Validation:**
- Provider without tool support still works for basic chat
- User informed about limitations
- Features degrade gracefully, don't crash

## Phase-Specific Warnings

| Phase | Pitfall Risk | Mitigation |
|-------|--------------|------------|
| Phase 1: Backend | Pitfalls 1, 2, 3, 4, 7, 13, 14 | Implement `LLMProvider` subclass with explicit format handling. Test tool calling, streaming, and multi-turn conversations. |
| Phase 2: Settings UI | Pitfalls 6, 10, 11, 12 | Implement provider-aware model discovery. Show restart prompt. Curate OpenRouter model list. |
| Phase 3: Connection Testing | Pitfalls 4, 5, 15 | Expand tests to validate streaming, tool calling, latency. Show detailed results per feature. |
| Phase 4: Model Discovery | Pitfalls 6, 10 | Implement per-provider model fetching. Curate recommended lists. Cache results. |

## Research Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Streaming tool calls | HIGH | Verified from OpenAI docs, community discussions, and CAAL's existing Groq implementation |
| Tool format variations | HIGH | Verified from official docs and CAAL's existing Ollama/Groq providers |
| OpenRouter routing | HIGH | Verified from OpenRouter official docs and multiple community reports |
| Provider-specific quirks | HIGH | Verified from official documentation of vLLM, LocalAI, LM Studio |
| Connection testing gaps | HIGH | Analyzed CAAL's existing test endpoints and common failure patterns |

## Sources

**OpenAI API Compatibility:**
- [OpenAI Compatible Providers - AI SDK](https://ai-sdk.dev/providers/openai-compatible-providers)
- [OpenAI-Compatible Endpoints - liteLLM](https://docs.litellm.ai/docs/providers/openai_compatible)
- [LM Studio OpenAI Compatibility](https://lmstudio.ai/docs/developer/openai-compat)
- [vLLM OpenAI-Compatible Server](https://docs.vllm.ai/en/stable/serving/openai_compatible_server/)

**Tool Calling:**
- [Function calling - OpenAI API](https://platform.openai.com/docs/guides/function-calling)
- [Tool support - Ollama Blog](https://ollama.com/blog/tool-support)
- [Tool Calling - vLLM](https://docs.vllm.ai/en/latest/features/tool_calling/)
- [OpenAI Community: Streaming with tool calls](https://community.openai.com/t/has-anyone-managed-to-get-a-tool-call-working-when-stream-true/498867)

**OpenRouter:**
- [OpenRouter Quickstart Guide](https://openrouter.ai/docs/quickstart)
- [Provider Routing - OpenRouter](https://openrouter.ai/docs/guides/routing/provider-selection)
- [Model Fallbacks - OpenRouter](https://openrouter.ai/docs/guides/routing/model-fallbacks)
- [List all models - OpenRouter](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [A practical guide to OpenRouter (Medium)](https://medium.com/@milesk_33/a-practical-guide-to-openrouter-unified-llm-apis-model-routing-and-real-world-use-d3c4c07ed170)

**Voice Assistant Latency:**
- [LLM Latency Benchmark by Use Cases in 2026](https://research.aimultiple.com/llm-latency-benchmark/)
- [Engineering for Real-Time Voice Agent Latency - Cresta](https://cresta.com/blog/engineering-for-real-time-voice-agent-latency)
- [Gladia - Comparing LLMs for voice agents](https://www.gladia.io/blog/comparing-llms-for-voice-agents)

**Local LLM Hosting:**
- [Local LLM Hosting: Complete 2026 Guide - Rost Glukhov](https://www.glukhov.org/post/2025/11/hosting-llms-ollama-localai-jan-lmstudio-vllm-comparison/)
- [Model compatibility table - LocalAI](https://localai.io/model-compatibility/)

**Authentication and API Patterns:**
- [OpenAI API Reference - Introduction](https://platform.openai.com/docs/api-reference/introduction)
- [Fix OpenAI API Key Issues in 2026](https://theaisurf.com/common-issues-with-openai-api-keys-and-how-to-fix-them/)
- [OpenAI Community: Authentication issues](https://community.openai.com/t/you-didnt-provide-an-api-key-you-need-to-provide-your-api-key-in-an-authorization-header-using-bearer-auth/561756)

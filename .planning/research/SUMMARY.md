# Project Research Summary

**Project:** CAAL Voice Assistant - LLM Provider Expansion
**Domain:** Voice Assistant Infrastructure (Adding OpenAI-compatible and OpenRouter providers)
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

CAAL's existing provider abstraction is well-designed for extension. Adding OpenAI-compatible and OpenRouter providers requires ZERO new dependencies - the existing `openai>=2.8.1` library (already present via `livekit-plugins-openai`) supports both use cases with its AsyncOpenAI client. OpenRouter is OpenAI-compatible by design and simply requires a `base_url` override. OpenAI-compatible servers (LM Studio, vLLM, LocalAI) all implement the same Chat Completions API.

The recommended approach is a two-provider implementation following CAAL's existing pattern: extend the `LLMProvider` base class, implement `chat()` and `chat_stream()` methods, and register via factory functions. Both providers will reuse tool calling and streaming logic from the existing GroqProvider (which already handles OpenAI-compatible format). The critical risk is assuming "OpenAI-compatible" means identical behavior - tool calling formats, streaming behavior, and model discovery all have provider-specific quirks that must be handled explicitly.

Implementation will follow a 5-phase approach: backend foundation (providers), settings integration, connection testing endpoints, frontend setup wizard, and settings panel UI. The architecture naturally decouples provider logic from the agent pipeline, making this a low-risk addition that preserves existing functionality while unlocking access to 400+ models through OpenRouter and local/self-hosted models through the generic OpenAI-compatible provider.

## Key Findings

### Recommended Stack

The milestone requires no new Python dependencies. The existing `openai>=2.8.1` library (present via livekit-plugins-openai transitive dependency) provides `AsyncOpenAI` client that works for both OpenRouter and OpenAI-compatible servers. The `httpx>=0.28.1` library (already included via openai dependency) handles model discovery via simple HTTP GET requests.

**Core technologies:**
- **openai (>=2.8.1)**: AsyncOpenAI client for OpenAI-compatible APIs - already present, supports async/await, streaming, tool calling
- **httpx (>=0.28.1)**: Async HTTP client for model discovery - already present, native async support for GET /v1/models endpoints
- **AsyncOpenAI pattern**: Single client works for both providers with base_url override - no provider-specific SDKs needed

**What NOT to add:**
- `openrouter` PyPI package (unnecessary, OpenRouter is OpenAI-compatible)
- `requests` library (prefer httpx for async consistency)
- Provider-specific client libraries (all implement OpenAI Chat Completions API)
- Pydantic models for API schemas (openai library already provides validation)

### Expected Features

Research identified clear feature tiers based on OpenAI API compatibility standards and CAAL's existing provider patterns.

**Must have (table stakes):**
- Chat completions with streaming support - core LLM interaction, required for voice responses
- Tool/function calling - CAAL's core feature for Home Assistant, n8n integration
- Bearer authentication with configurable base_url - multi-provider support
- Message format compatibility - system/user/assistant/tool roles
- Tool result format handling - feedback loop for tool execution
- Model parameter control - temperature, max_tokens for response tuning

**Should have (competitive):**
- Model listing API - settings UI auto-population (GET /v1/models endpoint)
- Error response format standardization - debugging and resilience
- Context window info - smart context management from model metadata
- Streaming tool call handling - some providers support streaming deltas
- OpenRouter-specific: model discovery with pricing data, automatic fallback, cost-based routing

**Defer (v2+):**
- Embeddings, image generation, audio transcription - out of scope for voice agent
- Fine-tuning APIs, moderation API, batch API - not runtime features
- Advanced OpenRouter features - auto model selection, provider routing preferences, debug mode

**Complexity assessment:**
- OpenAI-compatible provider: Low-Medium (mostly code reuse, main risk is inconsistent model listing)
- OpenRouter provider: Medium (model discovery with 400+ models adds complexity but high value)

### Architecture Approach

CAAL has a clean three-layer provider abstraction that separates provider-specific API logic from the agent pipeline: abstract base class (LLMProvider), concrete provider implementations (OllamaProvider, GroqProvider), and factory functions. The architecture is well-designed for extension with no modification to existing components required.

**Major components:**
1. **LLMProvider base class** (src/caal/llm/providers/base.py) - Defines contract: `chat()`, `chat_stream()`, `parse_tool_arguments()`, `format_tool_result()`. Provides sensible defaults that reduce boilerplate.
2. **Concrete provider implementations** - New files: `openai_provider.py`, `openrouter_provider.py`. Follow GroqProvider pattern: AsyncOpenAI client, override base_url, parse tool arguments from JSON string.
3. **Factory registration** (src/caal/llm/providers/__init__.py) - `create_provider()` factory maps provider names to classes, `create_provider_from_settings()` translates settings.json keys to constructor params.
4. **Settings integration** (src/caal/settings.py) - Add provider-specific keys to DEFAULT_SETTINGS, extend llm_provider enum.
5. **Frontend components** - Settings panel and setup wizard conditionally show provider-specific forms based on selected provider.

**Data flow:** Settings.json → load_settings() → create_provider_from_settings() → provider instance → CAALLLM wrapper → VoiceAssistant → llm_node() calls provider.chat/chat_stream().

**Key insight:** Settings changes require agent restart - the provider instance is created once at startup, not dynamically reloaded mid-session.

### Critical Pitfalls

1. **Streaming tool call format mismatch** - When tools are defined in streaming mode, some providers send tool call deltas instead of content deltas, producing zero text output and a silent session. Always set `tool_choice="none"` in streaming mode if tools are provided. Test streaming with tools registered, not just simple prompts.

2. **Tool call arguments format inconsistency** - Ollama returns arguments as dict, Groq returns JSON string, OpenAI-compatible providers vary. Implement robust `parse_tool_arguments()` that handles both string and dict inputs gracefully with type checking.

3. **Tool result message format differences** - Ollama requires `{role, content, tool_call_id}`, Groq additionally requires `name` field. Override `format_tool_result()` for each provider based on their API docs.

4. **Base URL and authentication confusion** - Different providers use different base URLs (OpenAI official vs LM Studio localhost vs vLLM custom vs OpenRouter). Make base_url fully configurable, make API key optional (local providers don't need it), normalize URLs by stripping trailing slashes.

5. **Model discovery API inconsistency** - Ollama uses GET /api/tags, OpenAI uses GET /v1/models, LM Studio may not have endpoint. Create provider-specific model discovery with graceful fallback to manual entry. For OpenRouter's 400+ models, implement curated list or search instead of full dropdown.

## Implications for Roadmap

Based on research, suggested phase structure follows the natural dependency chain from backend foundation to user-facing UI.

### Phase 1: Backend Provider Foundation
**Rationale:** Create provider implementations first before any UI can configure them. This phase establishes the API integration patterns and validates that tool calling and streaming work correctly with both new providers.

**Delivers:** Two new provider classes that can be instantiated programmatically. Developers can test providers with hardcoded API keys before exposing to users.

**Addresses:**
- Chat completions with streaming (table stakes)
- Tool/function calling (table stakes)
- Bearer auth with base_url config (table stakes)

**Avoids:**
- Pitfall 1 (streaming tool calls) - by explicitly setting tool_choice="none" in streaming mode
- Pitfall 2 (arguments format) - by implementing provider-specific parse_tool_arguments()
- Pitfall 3 (tool result format) - by overriding format_tool_result() for OpenAI format

**Files to create:**
- `src/caal/llm/providers/openai_provider.py` - OpenAI-compatible provider with configurable base_url
- `src/caal/llm/providers/openrouter_provider.py` - OpenRouter provider with fixed base_url

**Files to modify:**
- `src/caal/llm/providers/__init__.py` - Add factory registration for both providers

### Phase 2: Settings Schema Extension
**Rationale:** Add settings keys so providers can be configured via settings.json. This enables the factory pattern to work and allows manual configuration before UI is built.

**Delivers:** Settings schema that supports both new providers with proper defaults and migration for existing installations.

**Addresses:**
- Model parameter control (table stakes)
- Temperature, max_tokens configuration
- Settings migration for existing users

**Avoids:**
- Pitfall 14 (settings migration) - by adding new keys to DEFAULT_SETTINGS first and using .get() with defaults
- Pitfall 13 (STT/LLM coupling) - by documenting that OpenRouter/OpenAI-compatible only provide LLM, must use Speaches/Groq for STT

**Files to modify:**
- `src/caal/settings.py` - Add openai_api_key, openai_base_url, openai_model, openrouter_api_key, openrouter_model to DEFAULT_SETTINGS
- `src/caal/llm/providers/__init__.py` - Extend create_provider_from_settings() with new provider branches

### Phase 3: Connection Testing Endpoints
**Rationale:** Enable setup wizard and settings UI to validate API keys before saving configuration. Comprehensive testing prevents "connection test passes but agent fails" scenarios.

**Delivers:** Backend API endpoints that test not just connectivity but actual feature compatibility (streaming, tool calling).

**Addresses:**
- Model listing API (differentiator)
- Error response format handling
- Capability detection

**Avoids:**
- Pitfall 4 (base URL confusion) - by testing actual API calls with user-provided URLs
- Pitfall 5 (partial tool support) - by testing if provider accepts tools parameter
- Pitfall 15 (false positives) - by expanding tests beyond basic connectivity to validate streaming and tool calling

**Files to modify:**
- `src/caal/webhooks.py` - Add POST /setup/test-openai and POST /setup/test-openrouter endpoints with comprehensive validation

### Phase 4: Setup Wizard Frontend
**Rationale:** First-run experience is critical. Setup wizard should guide users through initial provider selection and API key configuration with connection testing.

**Delivers:** Extended setup wizard that includes OpenAI-compatible and OpenRouter as provider options with provider-specific forms and connection testing.

**Addresses:**
- Model discovery with pricing (OpenRouter differentiator)
- Multi-provider selection UI
- Curated model recommendations

**Avoids:**
- Pitfall 10 (400+ model dropdown) - by showing curated list of recommended models for OpenRouter
- Pitfall 11 (auto model unpredictability) - by not exposing openrouter/auto option
- Pitfall 8 (latency awareness) - by showing warning about OpenRouter network overhead in description

**Files to modify:**
- `frontend/components/setup/provider-step.tsx` - Extend provider toggle from 2-column to 4-option grid, add OpenAI/OpenRouter forms with test logic

### Phase 5: Settings Panel UI
**Rationale:** Allow runtime provider switching for users who want to change configuration after initial setup. This completes the full configuration lifecycle.

**Delivers:** Settings panel that supports all provider configurations with the same level of detail as setup wizard.

**Addresses:**
- Runtime provider management
- Model switching per provider
- Provider comparison and switching

**Avoids:**
- Pitfall 12 (provider switching without restart) - by showing restart prompt after provider change
- Pitfall 6 (model discovery inconsistency) - by implementing provider-specific model fetching with fallback to manual entry

**Files to modify:**
- `frontend/components/settings/settings-panel.tsx` - Extend Settings interface, add OpenAI/OpenRouter forms to Providers tab with test buttons

### Phase Ordering Rationale

- **Backend before frontend:** Providers must exist before UI can configure them. This allows incremental testing at each layer.
- **Settings schema before UI:** UI reads and writes settings keys, so schema must be stable first. This prevents frontend errors from missing keys.
- **Testing endpoints before UI:** UI calls test endpoints for connection validation. Endpoints must be working before frontend consumes them.
- **Setup wizard before settings panel:** Wizard is first-launch experience, panel is ongoing management. Get new user flow right first, then add advanced features.

This ordering minimizes rework and allows validation at each phase before proceeding. Each phase is independently testable and can be validated without downstream components.

### Research Flags

**Phases with standard patterns (low research needs):**
- **Phase 1:** Provider implementation follows established GroqProvider pattern, well-documented OpenAI API
- **Phase 2:** Settings extension is straightforward addition to existing schema
- **Phase 3:** Connection testing follows existing Ollama/Groq test pattern

**Phases needing validation during implementation:**
- **Phase 4:** Model discovery for OpenRouter may need UX research - 400+ models requires careful filtering/search design
- **Phase 5:** Provider switching UX needs user testing - restart requirement may cause confusion

**No deep research phases needed** - all technical patterns are well-established and documented in official sources.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies needed, existing openai library confirmed compatible via official docs and version verification |
| Features | HIGH | OpenAI API format is industry standard, well-documented. OpenRouter compatibility verified via official documentation. |
| Architecture | HIGH | All integration points identified from direct CAAL codebase inspection. Provider pattern proven with existing Ollama/Groq implementations. |
| Pitfalls | HIGH | Pitfalls verified from official documentation (OpenAI, OpenRouter, vLLM, LM Studio) and community consensus on common issues |

**Overall confidence:** HIGH

All research based on official documentation and direct code inspection. The provider abstraction pattern is already proven in CAAL with two working implementations (Ollama, Groq). Adding OpenAI-compatible providers follows the exact same pattern with minimal variation.

### Gaps to Address

**Provider-specific quirks:** While the OpenAI API is standardized, individual OpenAI-compatible servers (LM Studio, vLLM, LocalAI) may have implementation differences in:
- Tool calling support maturity (LM Studio is "experimental")
- Model discovery endpoint availability (some servers don't implement it)
- Streaming behavior edge cases

**Mitigation:** Phase 3 (connection testing) includes comprehensive validation that detects these quirks before user configuration is saved. Graceful degradation allows basic chat even if advanced features aren't supported.

**OpenRouter dynamic routing:** OpenRouter's provider selection algorithm may route the same model name to different backends, causing inconsistent behavior.

**Mitigation:** Document this limitation prominently in UI. Consider recommending direct provider connections (Groq, OpenAI) over OpenRouter for production voice assistants where consistency is critical.

**Context window management:** Different models have different context limits (8k vs 32k vs 128k). CAAL's existing sliding window is Ollama-specific.

**Mitigation:** Verify sliding window logic works with OpenAI-compatible providers during Phase 1 implementation. May need provider-specific tuning.

## Sources

### Primary (HIGH confidence)

**Stack Research:**
- [OpenAI Python API Library - PyPI](https://pypi.org/project/openai/) - Version verification, AsyncOpenAI client capabilities
- [OpenAI Python GitHub](https://github.com/openai/openai-python) - Official repository, release history
- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview) - Official API documentation
- [vLLM OpenAI-Compatible Server](https://docs.vllm.ai/en/stable/serving/openai_compatible_server/) - Implementation patterns
- [LM Studio OpenAI Compatibility](https://lmstudio.ai/docs/developer/openai-compat) - Endpoint documentation

**Features Research:**
- [OpenAI Chat Completions API Reference](https://platform.openai.com/docs/api-reference/chat) - Table stakes features
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling) - Tool format specification
- [OpenRouter Model Listing API](https://openrouter.ai/docs/api/api-reference/models/get-models) - Model discovery format
- [OpenRouter Model Fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks) - Automatic fallback behavior

**Architecture Research:**
- Direct code inspection of CAAL codebase (src/caal/llm/providers/, src/caal/settings.py, voice_agent.py)
- Existing provider implementations (ollama_provider.py, groq_provider.py)

**Pitfalls Research:**
- [OpenAI Community: Streaming with tool calls](https://community.openai.com/t/has-anyone-managed-to-get-a-tool-call-working-when-stream-true/498867) - Streaming tool call issues
- [OpenRouter Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection) - Dynamic routing behavior
- [LLM Latency Benchmark 2026](https://research.aimultiple.com/llm-latency-benchmark/) - Voice agent latency considerations
- [Local LLM Hosting Guide 2026](https://www.glukhov.org/post/2025/11/hosting-llms-ollama-localai-jan-lmstudio-vllm-comparison/) - Provider comparison

### Secondary (MEDIUM confidence)

- [OpenAI API Compatibility Standard](https://bentoml.com/llm/llm-inference-basics/openai-compatible-api) - Industry patterns
- [httpx vs requests comparison](https://oxylabs.io/blog/httpx-vs-requests-vs-aiohttp) - HTTP client selection rationale
- [Gladia - Comparing LLMs for voice agents](https://www.gladia.io/blog/comparing-llms-for-voice-agents) - Voice-specific considerations

---
*Research completed: 2026-02-05*
*Ready for roadmap: yes*

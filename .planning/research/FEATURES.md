# Features Research: LLM Providers (OpenAI-compatible and OpenRouter)

**Project:** CAAL Voice Assistant
**Focus:** Adding OpenAI-compatible and OpenRouter LLM providers
**Researched:** 2026-02-05
**Overall confidence:** HIGH (verified with official documentation and current 2026 sources)

## Executive Summary

OpenAI's Chat Completions API has become the de facto industry standard for LLM interfaces in 2026. Both OpenAI-compatible providers (generic implementation) and OpenRouter (unified multi-provider gateway) follow this standard format, making integration straightforward. However, they have distinct feature sets and use cases:

- **OpenAI-compatible providers** are primarily local/self-hosted solutions (vLLM, LocalAI, LiteLLM) or cloud services that mirror OpenAI's API format. They require explicit `base_url` and `api_key` configuration.
- **OpenRouter** is a cloud gateway that provides access to 400+ models from multiple providers with automatic fallback, cost optimization, and unified billing.

Both support the core features CAAL requires: streaming chat, tool calling, and programmatic model discovery. Key differences lie in model listing approaches, error handling, and advanced features.

---

## OpenAI-Compatible Provider

### Table Stakes (Must Have)

These features are expected in any OpenAI-compatible implementation and are critical for CAAL integration.

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|---------------------|
| **Chat Completions** | Core LLM interaction | Low | POST to `/v1/chat/completions` with messages array |
| **Streaming Support** | Required for voice responses | Low | Set `stream: true`, parse SSE (server-sent events) with `data:` prefix |
| **Tool/Function Calling** | CAAL's core feature | Medium | Pass `tools` array, receive `tool_calls` in response with JSON string arguments |
| **Bearer Auth** | OpenAI standard | Low | `Authorization: Bearer {api_key}` header |
| **base_url Configuration** | Multi-provider support | Low | Allow custom endpoint (e.g., `http://localhost:8000/v1`) |
| **Message Format** | Conversation history | Low | Support `role` (system/user/assistant/tool) and `content` fields |
| **Tool Result Format** | Tool execution feedback | Medium | `role: "tool"` with `tool_call_id` and `content` |
| **Model Parameter** | Specify which model | Low | `model` field in request body |
| **Temperature Control** | Response randomness | Low | `temperature` parameter (0.0-2.0) |
| **max_tokens Limit** | Cost/length control | Low | `max_tokens` parameter |

**Total Complexity:** Medium (mostly straightforward API calls, tool calling requires careful format handling)

### Differentiators (Competitive Advantage)

Features that distinguish quality OpenAI-compatible implementations.

| Feature | Value Proposition | Complexity | Implementation Notes |
|---------|-------------------|------------|---------------------|
| **Model Listing API** | Settings UI auto-population | Medium | GET `/v1/models` endpoint (not all providers implement this) |
| **Streaming Tool Calls** | Real-time function execution | High | Some providers support streaming tool call deltas, others don't |
| **Error Response Format** | Debugging and resilience | Low | Standard OpenAI error format with `error.type`, `error.message`, `error.code` |
| **Context Window Info** | Smart context management | Medium | Model listing includes `context_length` or `max_model_len` |
| **Retry-After Headers** | Rate limit handling | Low | `x-ratelimit-*` headers for intelligent backoff |
| **Multiple Models** | Flexibility | Low | Provider hosts multiple models accessible via model name |

**Recommendation:** Prioritize model listing API for better UX. Streaming tool calls are nice-to-have but not critical (CAAL uses non-streaming for tool execution).

### Anti-Features (Explicitly Avoid)

Features that add complexity without value for CAAL's use case.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Embeddings Support** | Not needed for voice agent | Skip `/v1/embeddings` endpoint entirely |
| **Image Generation** | Out of scope | Don't support `/v1/images/*` endpoints |
| **Audio Transcription** | CAAL uses Speaches/Groq STT | Don't integrate `/v1/audio/transcriptions` |
| **Fine-tuning APIs** | Not a runtime feature | Skip `/v1/fine-tuning/*` endpoints |
| **Moderation API** | Add latency, limited value | Skip `/v1/moderations` |
| **Batch API** | Voice is real-time | Don't support `/v1/batches` |
| **Custom Response Formats** | Adds complexity | Stick to standard `text` and `tool_calls` responses |

---

## OpenRouter Provider

### Table Stakes (Must Have)

OpenRouter-specific features that are expected given its positioning as a unified gateway.

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|---------------------|
| **Unified Endpoint** | Core value proposition | Low | All models use `https://openrouter.ai/api/v1` |
| **Model Namespacing** | Provider identification | Low | Models formatted as `provider/model` (e.g., `anthropic/claude-3.5-sonnet`) |
| **Model Discovery API** | 400+ models need discovery | Medium | GET `/api/v1/models` returns comprehensive model metadata |
| **Per-Token Pricing** | Cost transparency | Medium | Model listing includes `pricing.prompt` and `pricing.completion` in USD |
| **Automatic Fallback** | Reliability | Low | Pass array of models, auto-tries next on error (transparent to caller) |
| **Standard OpenAI Format** | Compatibility | Low | Identical to OpenAI Chat Completions API |
| **Tool Calling Support** | CAAL requirement | Medium | Full OpenAI tool/function calling format |
| **Streaming** | Voice responses | Low | SSE streaming identical to OpenAI |
| **Bearer Auth** | Standard | Low | `Authorization: Bearer {api_key}` |

**Total Complexity:** Medium (model discovery and pricing data add surface area)

### Differentiators (Competitive Advantage)

Features that make OpenRouter particularly valuable for CAAL.

| Feature | Value Proposition | Complexity | Implementation Notes |
|---------|-------------------|------------|---------------------|
| **Auto Model Selection** | Cost optimization | Medium | Special `openrouter/auto` model picks best model for prompt at lowest price |
| **Provider Routing** | Performance tuning | Medium | Filter by `quantization`, `throughput`, `latency` via `provider` parameter |
| **Fallback Without Config** | Zero-config resilience | Low | Automatic fallback to secondary providers if primary is down |
| **Model Metadata** | Informed selection | Low | API returns `context_length`, `max_completion_tokens`, `description` |
| **Performance Filtering** | Latency optimization | Medium | Filter providers by p90 throughput (e.g., >50 tokens/sec) |
| **Cost-Based Routing** | Budget control | Low | Default behavior prioritizes lowest-cost providers |
| **Debug Mode** | Troubleshooting | Low | `debug.echo_upstream_body: true` shows exact request sent to upstream |
| **Multi-Provider Auth** | Single API key | Low | One OpenRouter key accesses all providers (no per-provider keys) |

**Recommendation:** Implement model discovery with pricing data for settings UI. Auto model selection (`openrouter/auto`) is a killer feature for "smart default" mode.

### Anti-Features (Explicitly Avoid)

Features that don't fit CAAL's voice assistant use case.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-Time Voice Routing** | Adds 25-40ms latency | Use OpenRouter for non-latency-critical tasks only |
| **Advanced Provider Preferences** | Over-engineering | Stick to default routing (cost-optimized) for MVP |
| **Model Filtering UI** | Too many options (400+) | Provide curated list or search, not full dropdown |
| **Embeddings Models** | Not needed | Skip `GET /api/v1/embeddings/models` |
| **Per-Request Billing Alerts** | Adds complexity | Use OpenRouter dashboard for cost monitoring |

---

## Feature Dependencies

### Dependency Graph

```
OpenAI-Compatible Provider:
  base_url + api_key → Authentication
  Authentication → Chat Completions
  Chat Completions → Streaming
  Chat Completions → Tool Calling
  Tool Calling → Tool Result Format
  Model Listing (optional) → Settings UI Dropdown

OpenRouter Provider:
  api_key → Authentication
  Authentication → Model Discovery
  Model Discovery → Model Selection UI
  Model Selection → Chat Completions
  Chat Completions → Streaming
  Chat Completions → Tool Calling
  Tool Calling → Automatic Fallback
```

### Existing CAAL Features Leveraged

Both providers can reuse:
- **LLMProvider base class** - Abstract interface for `chat()`, `chat_stream()`, `parse_tool_arguments()`
- **Tool execution pipeline** - Both use OpenAI tool format (JSON string arguments)
- **Streaming handler** - SSE parsing is identical to OpenAI format
- **Settings UI** - Add provider selection dropdown, reuse model selection component

### New Features Required

| Feature | Provider | Reason |
|---------|----------|--------|
| Model listing with caching | Both | Avoid fetching models on every settings load |
| Pricing display | OpenRouter | Show cost per million tokens in UI |
| Fallback configuration | OpenRouter | Allow users to specify model priority list |
| Error retry logic | Both | Exponential backoff for rate limits (429 errors) |
| base_url validation | OpenAI-compatible | Ensure endpoint is reachable before saving |

---

## Complexity Assessment

### OpenAI-Compatible Provider

| Component | Complexity | Rationale |
|-----------|------------|-----------|
| Core chat | Low | Identical to Groq implementation |
| Streaming | Low | Same SSE format as existing providers |
| Tool calling | Low | Use base class format methods |
| Model listing | Medium | Endpoint may not exist, need graceful fallback |
| Error handling | Medium | Diverse error formats across implementations |
| **Overall** | **Low-Medium** | Mostly code reuse, main risk is inconsistent model listing |

### OpenRouter Provider

| Component | Complexity | Rationale |
|-----------|------------|-----------|
| Core chat | Low | Identical to OpenAI format |
| Streaming | Low | Same SSE format |
| Tool calling | Low | Use base class format methods |
| Model discovery | Medium | Large response (400+ models), needs filtering/caching |
| Pricing integration | Medium | Parse pricing data, display in UI |
| Fallback config | Low | Just pass array instead of single model |
| **Overall** | **Medium** | Model discovery and pricing add complexity, but high value |

---

## MVP Recommendation

### Phase 1: OpenAI-Compatible Provider (Minimal Viable)

**Priority features:**
1. Chat completions (non-streaming) - For tool calls
2. Chat completions (streaming) - For voice responses
3. Tool calling support - Core CAAL feature
4. base_url + api_key configuration - Essential settings
5. Basic error handling - 4xx/5xx with user-friendly messages

**Defer to post-MVP:**
- Model listing API (allow manual model name entry for MVP)
- Advanced retry logic (implement simple 1-retry on failure)
- Context window detection (rely on user configuration)

**Estimated effort:** 2-3 hours (high code reuse from GroqProvider)

### Phase 2: OpenRouter Provider (Full Featured)

**Priority features:**
1. All Phase 1 features
2. Model discovery API with caching
3. Pricing data display in settings UI
4. Model search/filtering (too many to list all)
5. Automatic fallback (pass model array)

**Defer to post-MVP:**
- Auto model selection (`openrouter/auto`)
- Provider routing preferences
- Debug mode integration

**Estimated effort:** 4-5 hours (model discovery UI adds time)

---

## Testing Checklist

### OpenAI-Compatible Provider

- [ ] Chat completion returns expected format
- [ ] Streaming yields text chunks correctly
- [ ] Tool calls parsed with JSON string arguments
- [ ] Tool results accepted in OpenAI format
- [ ] 401 errors handled (invalid API key)
- [ ] 404 errors handled (model not found)
- [ ] 429 errors trigger retry logic
- [ ] base_url with trailing slash works
- [ ] base_url without trailing slash works
- [ ] Model listing gracefully degrades if endpoint missing

### OpenRouter Provider

- [ ] Model discovery returns 400+ models
- [ ] Pricing data parsed correctly (string to float)
- [ ] Model search filters results
- [ ] Fallback array tried in order on error
- [ ] Tool calling works with multiple providers
- [ ] Streaming handles provider routing correctly
- [ ] Single API key accesses all models
- [ ] Rate limits handled gracefully

---

## Confidence Assessment

| Area | Confidence | Source | Notes |
|------|-----------|---------|-------|
| OpenAI API Format | HIGH | [Official OpenAI docs](https://platform.openai.com/docs/api-reference/chat) | Industry standard, well-documented |
| Tool Calling Format | HIGH | [Function calling guide](https://platform.openai.com/docs/guides/function-calling) | JSON schema format verified |
| Streaming Format | HIGH | [Streaming guide](https://platform.openai.com/docs/guides/streaming-responses) | SSE format standard |
| OpenRouter Model API | HIGH | [OpenRouter models docs](https://openrouter.ai/docs/api/api-reference/models/get-models) | Official API reference |
| OpenRouter Fallback | HIGH | [OpenRouter fallback docs](https://openrouter.ai/docs/guides/routing/model-fallbacks) | Verified 2026 behavior |
| Provider Compatibility | MEDIUM | [OpenAI-compatible comparison](https://www.glukhov.org/post/2025/11/hosting-llms-ollama-localai-jan-lmstudio-vllm-comparison/) | Some providers have quirks |
| Voice Latency Impact | MEDIUM | [OpenRouter latency docs](https://openrouter.ai/docs/guides/best-practices/latency-and-performance) | 25-40ms overhead verified |

---

## Sources

### OpenAI API Standards
- [Chat Completions API Reference](https://platform.openai.com/docs/api-reference/chat)
- [Streaming API Responses](https://platform.openai.com/docs/guides/streaming-responses)
- [Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Error Codes Reference](https://platform.openai.com/docs/guides/error-codes)
- [Rate Limits Guide](https://platform.openai.com/docs/guides/rate-limits)

### OpenRouter Documentation
- [Model Listing API](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [Model Fallbacks Guide](https://openrouter.ai/docs/guides/routing/model-fallbacks)
- [Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection)
- [API Error Handling](https://openrouter.ai/docs/api/reference/errors-and-debugging)
- [Latency and Performance](https://openrouter.ai/docs/guides/best-practices/latency-and-performance)
- [OpenRouter Models Overview](https://openrouter.ai/docs/guides/overview/models)

### OpenAI-Compatible Ecosystem
- [Local LLM Hosting Guide 2026](https://www.glukhov.org/post/2025/11/hosting-llms-ollama-localai-jan-lmstudio-vllm-comparison/)
- [OpenAI API Compatibility Standard](https://bentoml.com/llm/llm-inference-basics/openai-compatible-api)
- [OpenAI-compatible API Gold Standard](https://www.nscale.com/blog/has-openai-api-compatibility-become-the-gold-standard)

### Additional Context
- [OpenAI Realtime API Guide](https://platform.openai.com/docs/guides/realtime)
- [Latency Optimization Best Practices](https://platform.openai.com/docs/guides/latency-optimization)
- [How to Handle Rate Limits](https://cookbook.openai.com/examples/how_to_handle_rate_limits)

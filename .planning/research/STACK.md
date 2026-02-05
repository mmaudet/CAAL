# Stack Research: LLM Providers (OpenAI-Compatible & OpenRouter)

**Project:** CAAL Voice Assistant
**Researched:** 2026-02-05
**Overall Confidence:** HIGH

## Summary

Adding OpenAI-compatible and OpenRouter providers requires ZERO new dependencies. The existing `openai>=2.8.1` library (already present via `livekit-plugins-openai` transitive dependency) supports both use cases with its `AsyncOpenAI` client. The library automatically brings `httpx>=0.28.1` for async HTTP operations.

Key findings:
- OpenRouter is OpenAI-compatible by design, uses same client with `base_url` override
- OpenAI-compatible servers (LM Studio, vLLM, LocalAI) all implement OpenAI Chat Completions API
- Model discovery requires simple HTTP GET requests (httpx already available)
- No new Python packages needed
- Integration follows existing provider pattern (extend LLMProvider base class)

## Recommended Stack

### Core Dependencies

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| openai | >=2.8.1 | AsyncOpenAI client for OpenAI-compatible APIs | Already present (livekit-plugins-openai dependency). Supports async/await, streaming, tool calling. Latest is 2.16.0 (2026-01-27) but 2.8.1+ works. |
| httpx | >=0.28.1 | Async HTTP client for model discovery | Already present (openai dependency). Faster than requests, native async support. Used for GET /v1/models endpoints. |

### No Additional Libraries Required

The milestone can be completed with the existing dependency set. Do NOT add:
- `openrouter` PyPI package - unnecessary, OpenRouter is OpenAI-compatible
- `requests` - already present but prefer httpx for async consistency
- `aiohttp` - httpx already available and sufficient

## Integration Points

### 1. Provider Pattern (Existing)

Both new providers extend the existing `LLMProvider` base class:

```python
# src/caal/llm/providers/base.py (existing)
class LLMProvider(ABC):
    @abstractmethod
    async def chat(...) -> LLMResponse: ...
    @abstractmethod
    async def chat_stream(...) -> AsyncIterator[str]: ...
    def parse_tool_arguments(...) -> dict: ...
    def format_tool_result(...) -> dict: ...
```

Implementation pattern identical to GroqProvider:
- Use `AsyncOpenAI` client (async context)
- Override `base_url` for non-OpenAI endpoints
- Parse tool arguments from JSON string (OpenAI format)
- Include `name` field in tool results (OpenAI format)

### 2. AsyncOpenAI Client Usage

OpenRouter example:
```python
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings["openrouter_api_key"],
    default_headers={
        "HTTP-Referer": settings.get("app_url", ""),
        "X-Title": "CAAL Voice Assistant"
    }
)
```

OpenAI-compatible server example (LM Studio, vLLM, LocalAI):
```python
client = AsyncOpenAI(
    base_url="http://localhost:1234/v1",  # LM Studio default
    api_key="not-needed"  # Many local servers don't require keys
)
```

### 3. Model Discovery

OpenRouter models endpoint:
```python
# GET https://openrouter.ai/api/v1/models
import httpx

async def discover_openrouter_models(api_key: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {api_key}"}
        )
        data = response.json()
        return data["data"]  # List of model objects
```

OpenAI-compatible servers:
```python
# GET {base_url}/v1/models
async def discover_compatible_models(base_url: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{base_url}/v1/models")
        data = response.json()
        return data["data"]
```

### 4. Settings Schema Extension

Add to `DEFAULT_SETTINGS` in `src/caal/settings.py`:

```python
# OpenRouter settings
"openrouter_api_key": "",
"openrouter_model": "anthropic/claude-3.5-sonnet",

# OpenAI-compatible server settings
"openai_compatible_base_url": "http://localhost:1234/v1",
"openai_compatible_api_key": "",  # Optional, many servers don't need
"openai_compatible_model": "qwen3-8b",
```

Update `llm_provider` enum to include: `"openrouter"` and `"openai_compatible"`

### 5. Tool Calling Compatibility

Both OpenRouter and OpenAI-compatible servers follow OpenAI's tool calling format:
- Tools defined as `{"type": "function", "function": {...}}`
- Arguments returned as JSON string (parse with `json.loads()`)
- Tool results require `name` field in addition to `tool_call_id`

Reuse GroqProvider's implementation for:
- `parse_tool_arguments()` - JSON string parsing
- `format_tool_result()` - Include name field
- `format_tool_call_message()` - JSON.dumps for arguments

## What NOT to Add

### 1. openrouter PyPI Package
**Why avoid:** The `openrouter` package (v0.1.3) is a thin wrapper around the OpenAI SDK. CAAL already has the OpenAI SDK, so adding this introduces:
- Duplicate functionality
- Another dependency to maintain
- API surface area that differs from existing pattern

**Instead:** Use `AsyncOpenAI` with `base_url="https://openrouter.ai/api/v1"`

### 2. Separate HTTP Client for Model Discovery
**Why avoid:** httpx is already present via openai dependency. Adding requests or a custom HTTP solution creates:
- Inconsistent async patterns (requests is sync-only)
- Unnecessary dependencies

**Instead:** Use existing `httpx.AsyncClient` for `/v1/models` endpoints

### 3. Provider-Specific SDK Libraries
**Why avoid:** LM Studio, vLLM, LocalAI each offer their own client libraries, but:
- All implement OpenAI Chat Completions API
- Adding provider-specific clients increases complexity
- Single AsyncOpenAI client works for all

**Instead:** Single `OpenAICompatibleProvider` class with configurable `base_url`

### 4. Pydantic Models for API Schemas
**Why avoid:** The openai library already provides type hints and runtime validation. Adding Pydantic:
- Duplicates validation already in openai library
- Increases cognitive load (two validation systems)
- Not needed for the provider pattern

**Instead:** Trust openai library's typing and validation

## Version Verification

Based on web research (2026-02-05):

**OpenAI Python Library:**
- Current stable: 2.16.0 (released 2026-01-27)
- Installed: 2.8.1 (via livekit-plugins-openai)
- Minimum required: 2.0.0+ (for AsyncOpenAI support)
- Recommendation: Current version 2.8.1 is sufficient. Upgrade to 2.16.0 optional (not blocking).

**httpx:**
- Current stable: 0.28.1 (installed)
- Used by: openai library (transitive dependency)
- Features: Native async, HTTP/2 support, faster than requests
- Recommendation: Current version sufficient, no action needed.

**OpenRouter API:**
- Endpoint: https://openrouter.ai/api/v1
- Compatibility: OpenAI Chat Completions API (1:1 compatible)
- Model discovery: GET /api/v1/models (returns 400+ models)
- Authentication: Bearer token in Authorization header

**OpenAI-Compatible Servers:**
- vLLM: Full OpenAI API compatibility, tool calling support
- LM Studio: OpenAI endpoints, experimental tool calling (v0.2.9+)
- LocalAI: Full OpenAI compatibility, native function calling

## Implementation Checklist

- [ ] Create `OpenRouterProvider` class extending `LLMProvider`
- [ ] Create `OpenAICompatibleProvider` class extending `LLMProvider`
- [ ] Add settings fields for API keys and base URLs
- [ ] Implement model discovery functions using httpx
- [ ] Update frontend settings UI to include new provider options
- [ ] Add provider selection logic in agent initialization
- [ ] Test tool calling with both providers
- [ ] Document provider-specific configuration (base URLs, model selection)

## Sources

### OpenAI Python Library
- [OpenAI Python API Library - PyPI](https://pypi.org/project/openai/)
- [OpenAI Python GitHub - Official Repository](https://github.com/openai/openai-python)
- [OpenAI Python Releases](https://github.com/openai/openai-python/releases)

### OpenRouter
- [OpenRouter Quickstart Guide](https://openrouter.ai/docs/quickstart)
- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter OpenAI SDK Integration](https://openrouter.ai/docs/guides/community/openai-sdk)
- [OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [OpenRouter Python SDK Documentation](https://openrouter.ai/docs/sdks/python)

### OpenAI-Compatible Servers
- [vLLM OpenAI-Compatible Server Documentation](https://docs.vllm.ai/en/stable/serving/openai_compatible_server/)
- [LM Studio OpenAI Compatibility Endpoints](https://lmstudio.ai/docs/developer/openai-compat)
- [LM Studio Developer Documentation](https://lmstudio.ai/docs/developer)
- [Local LLM Hosting Complete 2026 Guide](https://www.glukhov.org/post/2025/11/hosting-llms-ollama-localai-jan-lmstudio-vllm-comparison/)

### HTTP Client Performance
- [HTTPX vs Requests vs AIOHTTP - Oxylabs](https://oxylabs.io/blog/httpx-vs-requests-vs-aiohttp)
- [Beyond Requests: Why httpx is the Modern HTTP Client](https://towardsdatascience.com/beyond-requests-why-httpx-is-the-modern-http-client-you-need-sometimes/)
- [Requests vs HTTPX - ScrapingAnt](https://scrapingant.com/blog/requests-vs-httpx)

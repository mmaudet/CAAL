# TTS Voices Configuration Guide

CAAL supports two Text-to-Speech (TTS) engines that can be used depending on your language requirements:

| Engine | Languages | Quality | Use Case |
|--------|-----------|---------|----------|
| **Kokoro** | English (primary), + 10 other languages | High quality, natural | Default for English |
| **Piper** (via openedai-speech) | French, English, 20+ languages | Good quality, fast | Recommended for French |

## Quick Start

### For English Users
No configuration needed. Default settings use Kokoro with `am_puck` voice.

### For French Users
Add to your `.env` file:
```bash
DEFAULT_LANGUAGE=fr
DEFAULT_TTS_VOICE=fr_FR-tom-medium
```

---

## Kokoro TTS (Default)

Kokoro is a high-quality neural TTS engine. It's the default for English voices.

### Voice Naming Convention
Voice IDs follow the pattern: `{language}{gender}_{name}`

- First letter: Language code
- Second letter: Gender (`f` = female, `m` = male)
- After underscore: Voice name

### Available Languages & Voices

#### American English (`a`)
| Voice ID | Gender | Description |
|----------|--------|-------------|
| `af_alloy` | Female | Balanced, versatile |
| `af_aoede` | Female | Warm, expressive |
| `af_bella` | Female | Friendly, conversational |
| `af_heart` | Female | Warm, caring |
| `af_jadzia` | Female | Professional |
| `af_jessica` | Female | Clear, articulate |
| `af_kore` | Female | Youthful |
| `af_nicole` | Female | Smooth, pleasant |
| `af_nova` | Female | Modern, dynamic |
| `af_river` | Female | Calm, flowing |
| `af_sarah` | Female | Natural, friendly |
| `af_sky` | Female | Light, airy |
| `am_adam` | Male | Deep, authoritative |
| `am_echo` | Male | Resonant |
| `am_eric` | Male | Friendly, approachable |
| `am_fenrir` | Male | Strong, distinctive |
| `am_liam` | Male | Young, energetic |
| `am_michael` | Male | Professional |
| `am_onyx` | Male | Deep, rich |
| `am_puck` | Male | Playful, expressive (recommended) |
| `am_santa` | Male | Warm, jolly |

#### British English (`b`)
| Voice ID | Gender | Description |
|----------|--------|-------------|
| `bf_alice` | Female | Classic British |
| `bf_emma` | Female | Modern British |
| `bf_lily` | Female | Soft, gentle |
| `bm_daniel` | Male | Distinguished |
| `bm_fable` | Male | Storyteller style |
| `bm_george` | Male | Traditional British |
| `bm_lewis` | Male | Contemporary |

#### French (`f`)
| Voice ID | Gender | Description |
|----------|--------|-------------|
| `ff_siwis` | Female | French female voice |

#### Spanish (`e`)
| Voice ID | Gender | Description |
|----------|--------|-------------|
| `ef_dora` | Female | Spanish female |
| `em_alex` | Male | Spanish male |
| `em_santa` | Male | Spanish male (festive) |

#### Hindi (`h`)
| Voice ID | Gender | Description |
|----------|--------|-------------|
| `hf_alpha` | Female | Hindi female |
| `hf_beta` | Female | Hindi female |
| `hm_omega` | Male | Hindi male |
| `hm_psi` | Male | Hindi male |

#### Italian (`i`)
| Voice ID | Gender | Description |
|----------|--------|-------------|
| `if_sara` | Female | Italian female |
| `im_nicola` | Male | Italian male |

#### Japanese (`j`)
| Voice ID | Gender | Description |
|----------|--------|-------------|
| `jf_alpha` | Female | Japanese female |
| `jf_gongitsune` | Female | Storytelling style |
| `jf_nezumi` | Female | Soft voice |
| `jf_tebukuro` | Female | Gentle |
| `jm_kumo` | Male | Japanese male |

#### Portuguese (`p`)
| Voice ID | Gender | Description |
|----------|--------|-------------|
| `pf_dora` | Female | Portuguese female |
| `pm_alex` | Male | Portuguese male |
| `pm_santa` | Male | Portuguese male |

#### Chinese Mandarin (`z`)
| Voice ID | Gender | Description |
|----------|--------|-------------|
| `zf_xiaobei` | Female | Beijing accent |
| `zf_xiaoni` | Female | Standard Mandarin |
| `zf_xiaoxiao` | Female | Youthful |
| `zf_xiaoyi` | Female | Professional |
| `zm_yunjian` | Male | Strong voice |
| `zm_yunxi` | Male | Clear, modern |
| `zm_yunxia` | Male | Warm |
| `zm_yunyang` | Male | Authoritative |

### Kokoro Configuration

```bash
# In .env
KOKORO_URL=http://localhost:8880  # or http://kokoro:8880 in Docker
TTS_VOICE=am_puck                 # Default voice
```

---

## Piper TTS (French Recommended)

Piper is an open-source TTS engine with excellent French voice support. CAAL uses it via [openedai-speech](https://github.com/matatonic/openedai-speech).

### French Voices

| Voice ID | Gender | Quality | Description |
|----------|--------|---------|-------------|
| `fr_FR-siwis-medium` | Female | Medium | Clear, natural French female |
| `fr_FR-tom-medium` | Male | Medium | Natural French male (recommended) |

### Additional Piper Voices

Piper supports many more voices that can be downloaded from [Hugging Face](https://huggingface.co/rhasspy/piper-voices).

#### Downloading New Voices

1. Find voices at: https://huggingface.co/rhasspy/piper-voices/tree/main
2. Download the `.onnx` and `.onnx.json` files
3. Place them in the `piper-voices` Docker volume or local voices directory

Example - Adding a new French voice:
```bash
# Download voice files
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx.json

# Copy to Docker volume (if using Docker)
docker cp fr_FR-upmc-medium.onnx caal-piper:/app/voices/
docker cp fr_FR-upmc-medium.onnx.json caal-piper:/app/voices/
```

Then add to `piper-config/voice_to_speaker.yaml`:
```yaml
tts-1:
  fr_FR-upmc-medium:
    model: voices/fr_FR-upmc-medium.onnx
    speaker:
```

### Available Piper Languages

| Language | Code | Example Voice |
|----------|------|---------------|
| French | `fr_FR` | `fr_FR-siwis-medium` |
| German | `de_DE` | `de_DE-thorsten-medium` |
| Spanish | `es_ES` | `es_ES-davefx-medium` |
| Italian | `it_IT` | `it_IT-riccardo-medium` |
| Dutch | `nl_NL` | `nl_NL-mls-medium` |
| Polish | `pl_PL` | `pl_PL-gosia-medium` |
| Portuguese | `pt_BR` | `pt_BR-faber-medium` |
| Russian | `ru_RU` | `ru_RU-irina-medium` |
| Ukrainian | `uk_UA` | `uk_UA-ukrainian_tts-medium` |
| And many more... | | |

Full list: https://rhasspy.github.io/piper-samples/

### Piper Configuration

```bash
# In .env
PIPER_URL=http://localhost:8001   # or http://piper:8000 in Docker
PIPER_PORT=8001                   # External port mapping
```

---

## Language Routing

CAAL automatically routes TTS requests to the appropriate engine:

| Language Setting | Voice Prefix | TTS Engine |
|------------------|--------------|------------|
| `en` | `af_*`, `am_*`, `bf_*`, `bm_*` | Kokoro |
| `fr` | `fr_*` | Piper |
| Other | Depends on voice | Auto-detected |

The routing logic:
- If `language=fr` OR voice starts with `fr_` → Piper
- Otherwise → Kokoro

---

## Configuration Examples

### English Setup (Default)
```bash
# .env
DEFAULT_LANGUAGE=en
DEFAULT_TTS_VOICE=am_puck
```

### French Setup
```bash
# .env
DEFAULT_LANGUAGE=fr
DEFAULT_STT_LANGUAGE=fr
DEFAULT_TTS_VOICE=fr_FR-tom-medium
```

### Bilingual Setup
Configure in English, switch to French via UI settings when needed:
```bash
# .env
DEFAULT_LANGUAGE=en
DEFAULT_TTS_VOICE=am_puck
```

Then change language in Settings UI to switch between English/French.

---

## Troubleshooting

### Voice Not Found
- Ensure the voice files (`.onnx` and `.onnx.json`) are in the voices directory
- Check `piper-config/voice_to_speaker.yaml` includes the voice mapping
- Restart the Piper container after adding new voices

### No Audio Output
- Check browser audio permissions
- Verify volume is not muted
- Check agent logs for TTS errors: `docker logs caal-agent`

### Wrong Language
- Verify `language` setting matches voice language
- French voices must start with `fr_` to route to Piper
- Disconnect and reconnect after changing language settings

### High Latency
- Piper is generally faster than Kokoro for single sentences
- First request may be slower (model loading)
- Check network connectivity between containers

---

## References

- [Kokoro TTS](https://github.com/thewh1teagle/kokoro-onnx) - High-quality neural TTS
- [Piper TTS](https://github.com/rhasspy/piper) - Fast, local neural TTS
- [openedai-speech](https://github.com/matatonic/openedai-speech) - OpenAI-compatible TTS server
- [Piper Voice Samples](https://rhasspy.github.io/piper-samples/) - Listen to available voices

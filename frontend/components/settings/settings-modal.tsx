'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GearSix, X } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/livekit/button';
import { Locale, useTranslation } from '@/lib/i18n';

interface Voice {
  id: string;
  language: string;
  name?: string;
}

interface Settings {
  agent_name: string;
  tts_voice: string;
  prompt: string;
  wake_greetings: string[];
  wake_greetings_fr: string[];
  temperature: number;
  model: string;
  num_ctx: number;
  max_turns: number;
  tool_cache_size: number;
  wake_word_enabled: boolean;
  wake_word_model: string;
  wake_word_threshold: number;
  wake_word_timeout: number;
  language: 'en' | 'fr';
  stt_language: 'auto' | 'en' | 'fr';
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDisconnect?: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  agent_name: 'Cal',
  tts_voice: 'am_puck',
  prompt: 'default',
  wake_greetings: ["Hey, what's up?", "What's up?", 'How can I help?'],
  wake_greetings_fr: ['Oui?', "Je t'ecoute!", "Comment puis-je t'aider?"],
  temperature: 0.7,
  model: 'ministral-3:8b',
  num_ctx: 8192,
  max_turns: 20,
  tool_cache_size: 3,
  wake_word_enabled: false,
  wake_word_model: 'models/hey_cal.onnx',
  wake_word_threshold: 0.5,
  wake_word_timeout: 3.0,
  language: 'en',
  stt_language: 'auto',
};

const DEFAULT_PROMPT = `# Voice Assistant

You are a helpful, conversational voice assistant.
{{CURRENT_DATE_CONTEXT}}

# Tool Priority

Always prefer using tools to answer questions when possible.
`;

export function SettingsModal({ isOpen, onClose, onDisconnect }: SettingsModalProps) {
  const { t, setLocale } = useTranslation();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [promptContent, setPromptContent] = useState('');
  const [, setCustomPromptExists] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [wakeWordModels, setWakeWordModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(10);

  // Helper to get cached settings from localStorage
  const getCachedSettings = (): Settings | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('caal-settings');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  // Helper to cache settings to localStorage
  const cacheSettings = (s: Settings) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('caal-settings', JSON.stringify(s));
    } catch {
      // Ignore localStorage errors
    }
  };

  // Load settings on mount
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Load cached settings first as fallback
    const cachedSettings = getCachedSettings();

    try {
      const [settingsRes, voicesRes, modelsRes, wakeWordModelsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/voices'),
        fetch('/api/models'),
        fetch('/api/wake-word/models'),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const loadedSettings = data.settings || DEFAULT_SETTINGS;
        setSettings(loadedSettings);
        cacheSettings(loadedSettings); // Cache for future use
        setPromptContent(data.prompt_content || DEFAULT_PROMPT);
        setCustomPromptExists(data.custom_prompt_exists || false);
        // Sync UI language with backend language on load
        if (loadedSettings.language) {
          setLocale(loadedSettings.language as Locale);
        }
      } else {
        console.warn('Failed to load settings from API, using cached or defaults');
        const fallback = cachedSettings || DEFAULT_SETTINGS;
        setSettings(fallback);
        setPromptContent(DEFAULT_PROMPT);
        if (fallback.language) {
          setLocale(fallback.language as Locale);
        }
      }

      if (voicesRes.ok) {
        const data = await voicesRes.json();
        setVoices(data.voices || []);
      }

      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setModels(data.models || []);
      }

      if (wakeWordModelsRes.ok) {
        const data = await wakeWordModelsRes.json();
        setWakeWordModels(data.models || []);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings from server');
      // Use cached settings as fallback when API fails
      const fallback = cachedSettings || DEFAULT_SETTINGS;
      setSettings(fallback);
      setPromptContent(DEFAULT_PROMPT);
      if (fallback.language) {
        setLocale(fallback.language as Locale);
      }
    } finally {
      setLoading(false);
    }
  }, [setLocale]);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  const handleSave = async () => {
    // Show confirmation dialog before saving
    setShowDisconnectConfirm(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setError(null);
    setShowDisconnectConfirm(false);

    try {
      // Save settings
      const settingsRes = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (!settingsRes.ok) {
        throw new Error('Failed to save settings');
      }

      // Cache settings locally for fallback
      cacheSettings(settings);

      // Save prompt if it was edited and prompt is set to custom
      if (settings.prompt === 'custom') {
        const promptRes = await fetch('/api/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: promptContent }),
        });

        if (!promptRes.ok) {
          throw new Error('Failed to save prompt');
        }
      }

      // Show countdown before disconnecting
      setShowCountdown(true);
      setSaving(false);

      for (let i = 10; i >= 0; i--) {
        setCountdownSeconds(i);

        // Pre-warm TTS and LLM services during countdown
        if (i === 8) {
          fetch('/api/warmup', { method: 'POST' })
            .then((res) => res.json())
            .then((data) => console.log('[Settings] Warmup result:', data))
            .catch((err) => console.warn('[Settings] Warmup failed:', err));
        }

        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Countdown finished - disconnect
      setShowCountdown(false);
      onClose();
      if (onDisconnect) {
        onDisconnect();
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
      setShowCountdown(false);
      setSaving(false);
    }
  };

  const handleCancelSave = () => {
    setShowDisconnectConfirm(false);
    onClose(); // Fermer le modal et revenir à l'agent
  };

  const handlePromptChange = (value: string) => {
    setSettings({ ...settings, prompt: value });
    // If switching to custom and custom doesn't exist, keep current content
  };

  const handleWakeGreetingsChange = (value: string, lang: 'en' | 'fr') => {
    const greetings = value.split('\n').filter((g) => g.trim());
    if (lang === 'fr') {
      setSettings({ ...settings, wake_greetings_fr: greetings });
    } else {
      setSettings({ ...settings, wake_greetings: greetings });
    }
  };

  // Filter voices by selected language
  const filteredVoices = voices.filter((v) => v.language === settings.language);

  if (!isOpen) return null;

  const isPromptReadOnly = settings.prompt === 'default';

  // Use portal to render modal at document body level (avoids CSS filter stacking context issues)
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border-input dark:border-muted flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border shadow-xl">
        {/* Header - fixed */}
        <div className="border-input dark:border-muted flex shrink-0 items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <GearSix weight="bold" className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded p-1"
          >
            <X weight="bold" className="h-5 w-5" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading ? (
            <div className="text-muted-foreground py-8 text-center">{t('settings.loading')}</div>
          ) : (
            <>
              {error && <div className="rounded-md bg-red-500/10 p-3 text-red-500">{error}</div>}

              {/* Language Selection */}
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('settings.language')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // When switching language, also switch to a voice in that language if available
                      const newVoices = voices.filter((v) => v.language === 'en');
                      const currentVoiceInNewLang = newVoices.find(
                        (v) => v.id === settings.tts_voice
                      );
                      setSettings({
                        ...settings,
                        language: 'en',
                        tts_voice: currentVoiceInNewLang
                          ? settings.tts_voice
                          : newVoices[0]?.id || 'am_puck',
                      });
                      // Sync UI language with backend language
                      setLocale('en' as Locale);
                    }}
                    className={`rounded-md px-4 py-1.5 text-sm ${
                      settings.language === 'en'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => {
                      const newVoices = voices.filter((v) => v.language === 'fr');
                      const currentVoiceInNewLang = newVoices.find(
                        (v) => v.id === settings.tts_voice
                      );
                      setSettings({
                        ...settings,
                        language: 'fr',
                        tts_voice: currentVoiceInNewLang
                          ? settings.tts_voice
                          : newVoices[0]?.id || 'fr_FR-siwis-medium',
                      });
                      // Sync UI language with backend language
                      setLocale('fr' as Locale);
                    }}
                    className={`rounded-md px-4 py-1.5 text-sm ${
                      settings.language === 'fr'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    Français
                  </button>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Controls TTS voice and wake greetings language
                </p>
              </div>

              {/* STT Language Hint */}
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('settings.sttLanguage')}</label>
                <select
                  value={settings.stt_language}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      stt_language: e.target.value as 'auto' | 'en' | 'fr',
                    })
                  }
                  className="border-input bg-background w-full rounded-md border px-3 py-2"
                >
                  <option value="auto">{t('settings.autoDetect')}</option>
                  <option value="en">{t('settings.englishOnly')}</option>
                  <option value="fr">{t('settings.frenchOnly')}</option>
                </select>
                <p className="text-muted-foreground text-xs">
                  Hint for speech-to-text. Auto works well for most cases.
                </p>
              </div>

              {/* Agent Name */}
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('settings.agentName')}</label>
                <input
                  type="text"
                  value={settings.agent_name}
                  onChange={(e) => setSettings({ ...settings, agent_name: e.target.value })}
                  className="border-input bg-background w-full rounded-md border px-3 py-2"
                />
              </div>

              {/* Voice (filtered by language) */}
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('settings.voice')}</label>
                <select
                  value={settings.tts_voice}
                  onChange={(e) => setSettings({ ...settings, tts_voice: e.target.value })}
                  className="border-input bg-background w-full rounded-md border px-3 py-2"
                >
                  {filteredVoices.length > 0 ? (
                    filteredVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name || voice.id}
                      </option>
                    ))
                  ) : (
                    <option value={settings.tts_voice}>{settings.tts_voice}</option>
                  )}
                </select>
              </div>

              {/* Prompt Selection */}
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('settings.prompt')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePromptChange('default')}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      settings.prompt === 'default'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {t('settings.default')}
                  </button>
                  <button
                    onClick={() => handlePromptChange('custom')}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      settings.prompt === 'custom'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {t('settings.custom')}
                  </button>
                </div>
              </div>

              {/* Prompt Content */}
              <div className="space-y-1">
                <label className="text-muted-foreground text-sm">
                  {isPromptReadOnly ? 'Default prompt (read-only)' : 'Custom prompt'}
                </label>
                <textarea
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  readOnly={isPromptReadOnly}
                  rows={6}
                  className={`border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-sm ${
                    isPromptReadOnly ? 'cursor-not-allowed opacity-60' : ''
                  }`}
                />
              </div>

              {/* Wake Greetings - show based on selected language */}
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Wake Greetings ({settings.language === 'fr' ? 'Français' : 'English'})
                </label>
                <textarea
                  value={
                    settings.language === 'fr'
                      ? settings.wake_greetings_fr.join('\n')
                      : settings.wake_greetings.join('\n')
                  }
                  onChange={(e) => handleWakeGreetingsChange(e.target.value, settings.language)}
                  rows={4}
                  placeholder={
                    settings.language === 'fr'
                      ? "Oui?\nJe t'ecoute!"
                      : "Hey, what's up?\nWhat's up?"
                  }
                  className="border-input bg-background w-full rounded-md border px-3 py-2"
                />
              </div>

              {/* Model */}
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('settings.model')}</label>
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="border-input bg-background w-full rounded-md border px-3 py-2"
                >
                  {models.length > 0 ? (
                    models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))
                  ) : (
                    <option value={settings.model}>{settings.model}</option>
                  )}
                </select>
              </div>

              {/* Numeric Settings Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('settings.temperature')}</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) =>
                      setSettings({ ...settings, temperature: parseFloat(e.target.value) || 0.7 })
                    }
                    className="border-input bg-background w-full rounded-md border px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('settings.contextSize')}</label>
                  <input
                    type="number"
                    min="1024"
                    max="131072"
                    step="1024"
                    value={settings.num_ctx}
                    onChange={(e) =>
                      setSettings({ ...settings, num_ctx: parseInt(e.target.value) || 8192 })
                    }
                    className="border-input bg-background w-full rounded-md border px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('settings.maxTurns')}</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={settings.max_turns}
                    onChange={(e) =>
                      setSettings({ ...settings, max_turns: parseInt(e.target.value) || 20 })
                    }
                    className="border-input bg-background w-full rounded-md border px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('settings.toolCache')}</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={settings.tool_cache_size}
                    onChange={(e) =>
                      setSettings({ ...settings, tool_cache_size: parseInt(e.target.value) || 3 })
                    }
                    className="border-input bg-background w-full rounded-md border px-3 py-2"
                  />
                </div>
              </div>

              {/* Wake Word Section */}
              <div className="border-input dark:border-muted space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">{t('settings.wakeWord')}</label>
                    <p className="text-muted-foreground text-xs">
                      {t('settings.wakeWordHint', { wakeWord: 'Hey Cal' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.wake_word_enabled}
                    onClick={() =>
                      setSettings({ ...settings, wake_word_enabled: !settings.wake_word_enabled })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                      settings.wake_word_enabled ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.wake_word_enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {settings.wake_word_enabled && (
                  <>
                    {/* Wake Word Model Selector */}
                    <div className="space-y-1 pt-2">
                      <label className="text-muted-foreground text-xs">
                        {t('settings.wakeWordModel')}
                      </label>
                      <select
                        value={settings.wake_word_model}
                        onChange={(e) =>
                          setSettings({ ...settings, wake_word_model: e.target.value })
                        }
                        className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                      >
                        {wakeWordModels.length > 0 ? (
                          wakeWordModels.map((model) => (
                            <option key={model} value={model}>
                              {model
                                .replace('models/', '')
                                .replace('.onnx', '')
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, (c) => c.toUpperCase())}
                            </option>
                          ))
                        ) : (
                          <option value={settings.wake_word_model}>
                            {settings.wake_word_model
                              .replace('models/', '')
                              .replace('.onnx', '')
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </option>
                        )}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">
                          {t('settings.threshold')}
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          max="1.0"
                          step="0.1"
                          value={settings.wake_word_threshold}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              wake_word_threshold: parseFloat(e.target.value) || 0.5,
                            })
                          }
                          className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">
                          {t('settings.timeout')}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          step="0.5"
                          value={settings.wake_word_timeout}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              wake_word_timeout: parseFloat(e.target.value) || 3.0,
                            })
                          }
                          className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Note about session restart */}
              <p className="text-muted-foreground text-xs">{t('settings.modelNote')}</p>
            </>
          )}
        </div>

        {/* Footer - fixed */}
        <div className="border-input dark:border-muted flex shrink-0 justify-end gap-2 border-t p-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('settings.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={loading || saving}>
            {saving ? t('settings.saving') : t('settings.save')}
          </Button>
        </div>

        {/* Disconnect Confirmation Dialog */}
        {showDisconnectConfirm && (
          <div className="bg-background bg-opacity-95 absolute inset-0 flex items-center justify-center rounded-lg">
            <div className="mx-4 max-w-sm space-y-4 text-center">
              <h3 className="text-lg font-semibold">{t('settings.disconnectConfirmTitle')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('settings.disconnectConfirmMessage')}
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="secondary" onClick={handleCancelSave}>
                  {t('settings.no')}
                </Button>
                <Button variant="destructive" onClick={handleConfirmSave} disabled={saving}>
                  {saving ? t('settings.saving') : t('settings.yes')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Countdown Display */}
        {showCountdown && (
          <div className="bg-background bg-opacity-95 absolute inset-0 flex items-center justify-center rounded-lg">
            <div className="mx-4 max-w-sm space-y-4 text-center">
              <div className="text-primary text-6xl font-bold">{countdownSeconds}</div>
              <p className="text-muted-foreground text-sm">{t('settings.restarting')}</p>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full transition-all duration-1000"
                  style={{ width: `${(10 - countdownSeconds) * 10}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

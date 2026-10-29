import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchStatus, isConnected, type DataStatus, type OwnKey, type ProviderId } from '../api/pipeline';
import { load, save } from './storage';

export interface AiSettings {
  mode: 'free' | 'own';
  provider: ProviderId;
  apiKey: string;
  model: string;
}

export const providers: { id: ProviderId; label: string; keyUrl: string; models: string[] }[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4.1-mini', 'gpt-4.1'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyUrl: 'https://openrouter.ai/keys',
    models: ['google/gemini-2.5-flash', 'anthropic/claude-sonnet-5-5', 'openai/gpt-4.1-mini'],
  },
];

const SETTINGS_KEY = 'pipeline.ai-settings';
const defaults: AiSettings = { mode: 'free', provider: 'gemini', apiKey: '', model: '' };

interface SettingsValue {
  settings: AiSettings;
  update: (next: AiSettings) => void;
  /** The key to send with questions, when the visitor chose their own. */
  ownKey: OwnKey | undefined;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  status: DataStatus | null;
  statusError: string | null;
  refreshStatus: () => void;
  /** Free questions used today, as last reported by the server. */
  freeUsage: { used: number; limit: number } | null;
  setFreeUsage: (usage: { used: number; limit: number }) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AiSettings>(() => ({ ...defaults, ...load(SETTINGS_KEY, {}) }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [freeUsage, setFreeUsage] = useState<{ used: number; limit: number } | null>(null);

  const update = useCallback((next: AiSettings) => {
    setSettings(next);
    save(SETTINGS_KEY, next);
  }, []);

  const refreshStatus = useCallback(() => {
    if (!isConnected) {
      setStatusError('Live data isn’t connected yet');
      return;
    }
    fetchStatus()
      .then((s) => {
        setStatus(s);
        setStatusError(null);
      })
      .catch((e: Error) => setStatusError(e.message));
  }, []);

  useEffect(refreshStatus, [refreshStatus]);

  const value = useMemo<SettingsValue>(() => {
    const ownKey =
      settings.mode === 'own' && settings.apiKey.trim()
        ? { provider: settings.provider, apiKey: settings.apiKey.trim(), model: settings.model.trim() || undefined }
        : undefined;
    return {
      settings,
      update,
      ownKey,
      settingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
      status,
      statusError,
      refreshStatus,
      freeUsage,
      setFreeUsage,
    };
  }, [settings, update, settingsOpen, status, statusError, refreshStatus, freeUsage]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}

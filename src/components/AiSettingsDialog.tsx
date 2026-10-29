import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { providers, useSettings, type AiSettings } from '../state/settings';
import { useToast } from '../state/toast';
import { Button } from './controls';
import styles from './AiSettingsDialog.module.css';

/** Free demo or your own key. Keys stay in this browser. */
export function AiSettingsDialog() {
  const { settings, update, settingsOpen, closeSettings, status, freeUsage } = useSettings();
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<AiSettings>(settings);
  const ids = { provider: useId(), key: useId(), model: useId(), models: useId() };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (settingsOpen && !dialog.open) {
      setDraft(settings);
      dialog.showModal();
    } else if (!settingsOpen && dialog.open) {
      dialog.close();
    }
  }, [settingsOpen, settings]);

  const provider = providers.find((p) => p.id === draft.provider) ?? providers[0];
  const set = (patch: Partial<AiSettings>) => setDraft((d) => ({ ...d, ...patch }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draft.mode === 'own' && !draft.apiKey.trim()) {
      toast.show('Paste your API key, or switch back to the free demo.');
      return;
    }
    update(draft);
    closeSettings();
    toast.show(draft.mode === 'own' ? `Using your ${provider.label} key.` : 'Using the free demo.');
  };

  const freeLimit = freeUsage?.limit ?? status?.free_per_visitor;
  const freeLeft = freeUsage ? Math.max(freeUsage.limit - freeUsage.used, 0) : freeLimit;

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby="ai-settings-title" onClose={closeSettings}>
      <form className={styles.form} onSubmit={submit}>
        <h2 id="ai-settings-title" className={styles.title}>
          AI settings
        </h2>

        <fieldset className={styles.modes}>
          <legend className="visually-hidden">Which AI answers your questions</legend>
          <label className={`${styles.mode} ${draft.mode === 'free' ? styles.modeOn : ''}`}>
            <input type="radio" name="mode" checked={draft.mode === 'free'} onChange={() => set({ mode: 'free' })} />
            <span className={styles.modeText}>
              <strong>Free demo</strong>
              <span>
                {status && !status.free_tier
                  ? 'Not set up on this site yet.'
                  : freeLimit
                    ? `${freeLeft} of ${freeLimit} free questions left today.`
                    : 'A few free questions a day.'}
              </span>
            </span>
          </label>
          <label className={`${styles.mode} ${draft.mode === 'own' ? styles.modeOn : ''}`}>
            <input type="radio" name="mode" checked={draft.mode === 'own'} onChange={() => set({ mode: 'own' })} />
            <span className={styles.modeText}>
              <strong>Your own key</strong>
              <span>No daily limit. Use Gemini, Claude, OpenAI or OpenRouter.</span>
            </span>
          </label>
        </fieldset>

        {draft.mode === 'own' && (
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor={ids.provider}>Provider</label>
              <select
                id={ids.provider}
                value={draft.provider}
                onChange={(e) => set({ provider: e.target.value as AiSettings['provider'], model: '' })}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor={ids.key}>API key</label>
              <input
                id={ids.key}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={draft.apiKey}
                onChange={(e) => set({ apiKey: e.target.value })}
                placeholder="Paste your key"
              />
              <a href={provider.keyUrl} target="_blank" rel="noreferrer" className={styles.hint}>
                Get a key from {provider.label}
              </a>
            </div>
            <div className={styles.field}>
              <label htmlFor={ids.model}>Model</label>
              <input
                id={ids.model}
                list={ids.models}
                value={draft.model}
                onChange={(e) => set({ model: e.target.value })}
                placeholder={provider.models[0]}
              />
              <datalist id={ids.models}>
                {provider.models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <p className={styles.privacy}>
              Your key is saved only in this browser. It’s sent with each question to run that one answer and is never
              stored on the server.
            </p>
          </div>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={closeSettings}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </dialog>
  );
}

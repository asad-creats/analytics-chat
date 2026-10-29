import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { dataset, teamScopes } from '../data/demo';
import { Icon } from './Icon';
import styles from './Composer.module.css';

interface ComposerProps {
  /** "hero" is the home-page box; "inline" is the follow-up bar under answers. */
  variant?: 'hero' | 'inline';
  label: string;
  placeholder: string;
  onSubmit: (question: string) => void;
  /** While an answer is being worked out the send button becomes Stop. */
  busy?: boolean;
  busyText?: string;
  onStop?: () => void;
  autoFocus?: boolean;
}

export function Composer({
  variant = 'inline',
  label,
  placeholder,
  onSubmit,
  busy = false,
  busyText,
  onStop,
  autoFocus,
}: ComposerProps) {
  const id = useId();
  const [value, setValue] = useState('');
  const [scope, setScope] = useState(teamScopes[0]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const question = value.trim();
    if (!question || busy) return;
    onSubmit(question);
    setValue('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) submit(event);
  };

  const action = busy ? (
    <button type="button" aria-label="Stop" className={`${styles.send} ${styles.stop}`} onClick={onStop}>
      <span aria-hidden="true" className={styles.stopMark} />
    </button>
  ) : (
    <button type="submit" aria-label="Ask" className={styles.send}>
      <Icon name="send" size={variant === 'hero' ? 18 : 16} />
    </button>
  );

  if (variant === 'hero') {
    return (
      <form className={styles.heroForm} onSubmit={submit}>
        <div className={styles.hero}>
          <label htmlFor={id} className="visually-hidden">
            {label}
          </label>
          <textarea
            id={id}
            rows={3}
            className={styles.heroInput}
            placeholder={busy ? busyText : placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            autoFocus={autoFocus}
          />
          <div className={styles.heroActions}>
            <label className={styles.scope}>
              <span className="visually-hidden">Whose data</span>
              <select value={scope} onChange={(event) => setScope(event.target.value)}>
                {teamScopes.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <Icon name="caretDown" />
            </label>
            <span className={styles.hint}>Press Enter to ask</span>
            {action}
          </div>
        </div>
        <div className={styles.freshness}>
          <Icon name="clock" />
          <span>
            Data as of {dataset.asOf} today · {dataset.leadCount} leads · refreshes daily
          </span>
        </div>
      </form>
    );
  }

  return (
    <form className={styles.inline} onSubmit={submit}>
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <input
        id={id}
        type="text"
        className={styles.inlineInput}
        placeholder={busy ? busyText : placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoFocus={autoFocus}
      />
      {action}
    </form>
  );
}

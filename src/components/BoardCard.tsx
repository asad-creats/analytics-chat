import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePins, type PinId } from '../state/pins';
import { PinButton } from './controls';
import { Icon } from './Icon';
import styles from './BoardCard.module.css';

interface BoardCardProps {
  pinId: PinId;
  title: string;
  figure: string;
  context: string;
  /** Answer page that holds the full method. */
  to?: string;
  /** Footer note; defaults to the last refresh time. */
  note?: string;
  /** Today's refresh failed: show the last good run and offer a retry. */
  stale?: { message: string; onRetry: () => void };
  children: ReactNode;
}

export function BoardCard({ pinId, title, figure, context, to, note = 'Updated 7:00 AM', stale, children }: BoardCardProps) {
  const pins = usePins();
  return (
    <article id={pinId} className={`${styles.card} answer-in`}>
      <div className={styles.body}>
        <div className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          <PinButton variant="icon" pinned={pins.isPinned(pinId)} onToggle={() => pins.toggle(pinId)} />
        </div>
        <div className={styles.headline}>
          {to ? (
            <Link to={to} className={styles.figure}>
              {figure}
            </Link>
          ) : (
            <span className={styles.figure}>{figure}</span>
          )}
          <span className={styles.context}>{context}</span>
        </div>
        {children}
      </div>
      {stale ? (
        <div className={`${styles.footer} ${styles.stale}`}>
          <span className={styles.staleMessage}>
            <Icon name="warning" />
            {stale.message}
          </span>
          <button type="button" className={styles.retry} onClick={stale.onRetry}>
            Retry
          </button>
        </div>
      ) : (
        <div className={styles.footer}>
          <span>{note}</span>
          {to && (
            <Link to={to} className={styles.methodLink}>
              How I got this
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

/** Label-and-value rows, used for short ranked lists on the board. */
export function BoardList({ rows }: { rows: { label: ReactNode; value: ReactNode; extra?: ReactNode }[] }) {
  return (
    <div className={styles.list}>
      {rows.map((row, i) => (
        <div key={i} className={`${styles.listRow} ${row.extra ? styles.listRowWide : ''}`}>
          {row.extra}
          <span className={styles.listLabel}>{row.label}</span>
          <span className={styles.listValue}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { dataset } from '../data/demo';
import { usePins, type PinId } from '../state/pins';
import { useToast } from '../state/toast';
import { Button, FilterChip, PinButton } from './controls';
import { Icon } from './Icon';
import styles from './AnswerCard.module.css';

interface MethodContextValue {
  methodId: string;
  reveal: () => void;
}

const MethodContext = createContext<MethodContextValue | null>(null);

/**
 * A key number in an answer. Dotted underline; activating it opens
 * "How I got this" so every number can be traced to its query.
 */
export function LinkedNumber({ children }: { children: ReactNode }) {
  const method = useContext(MethodContext);
  const onClick = (event: MouseEvent) => {
    event.preventDefault();
    method?.reveal();
  };
  return (
    <a href={method ? `#${method.methodId}` : undefined} className={styles.linkedNumber} onClick={onClick}>
      {children}
    </a>
  );
}

export interface MethodDetails {
  /** Shown beside the toggle so it's useful even when shut. */
  scope: string;
  steps?: string[];
  description?: string;
  filters: string[];
  query?: string;
}

interface AnswerCardProps {
  /** page: the full answer view. thread: a card in a conversation. */
  variant?: 'page' | 'thread';
  /** Thread cards carry the question as their own heading. */
  question?: string;
  summary: ReactNode;
  pinId?: PinId;
  method: MethodDetails;
  methodOpen?: boolean;
  /** Follow-up chips inside the card (thread). Page follow-ups sit outside. */
  followUps?: ReactNode;
  children?: ReactNode;
  id?: string;
}

export function AnswerCard({
  variant = 'page',
  question,
  summary,
  pinId,
  method,
  methodOpen = false,
  followUps,
  children,
  id,
}: AnswerCardProps) {
  const methodId = useId();
  const [open, setOpen] = useState(methodOpen);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pins = usePins();
  const toast = useToast();

  const reveal = useCallback(() => {
    setOpen(true);
    toggleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toggleRef.current?.focus({ preventScroll: true });
  }, []);

  const pin = pinId && <PinButton pinned={pins.isPinned(pinId)} onToggle={() => pins.toggle(pinId)} />;

  const share = () => {
    void navigator.clipboard?.writeText(window.location.href);
    toast.show('Link copied. Shared charts are labelled “Demo · fake data”.');
  };

  return (
    <MethodContext.Provider value={{ methodId, reveal }}>
      <article
        id={id}
        aria-label={question ? `Answer: ${question}` : 'Answer'}
        className={`${styles.card} ${variant === 'thread' ? styles.thread : styles.page} answer-in`}
      >
        {variant === 'page' ? (
          <div className={styles.pageHead}>
            <p className={styles.pageSummary}>{summary}</p>
            <div className={styles.actions}>
              {pin}
              <Button size="md" variant="ghost" icon="share" aria-label="Share chart" onClick={share} />
            </div>
          </div>
        ) : (
          <div className={styles.threadBody}>
            <div className={styles.threadHead}>
              <h2 className={styles.threadTitle}>{question}</h2>
              {pin}
            </div>
            <p className={styles.threadSummary}>{summary}</p>
            {children}
          </div>
        )}

        {variant === 'page' && children}

        <MethodPanel
          id={methodId}
          details={method}
          open={open}
          onToggle={() => setOpen(!open)}
          toggleRef={toggleRef}
          variant={variant}
        />

        {followUps && <div className={styles.followUps}>{followUps}</div>}
      </article>
    </MethodContext.Provider>
  );
}

interface MethodPanelProps {
  id: string;
  details: MethodDetails;
  open: boolean;
  onToggle: () => void;
  toggleRef: RefObject<HTMLButtonElement>;
  variant: 'page' | 'thread';
}

/** "How I got this": plain words first, filters, then the query. */
function MethodPanel({ id, details, open, onToggle, toggleRef, variant }: MethodPanelProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const panelId = `${id}-panel`;

  const copy = () => {
    if (!details.query) return;
    void navigator.clipboard?.writeText(details.query);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const filters = (
    <div className={styles.chips}>
      {details.filters.map((filter) => (
        <FilterChip key={filter}>{filter}</FilterChip>
      ))}
    </div>
  );

  const query = details.query && <pre className={styles.query}>{details.query}</pre>;

  return (
    <section id={id} aria-label="How I got this" className={`${styles.method} ${variant === 'thread' ? styles.methodThread : ''}`}>
      <button
        ref={toggleRef}
        type="button"
        className={styles.methodToggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <Icon name={open ? 'chevronDown' : 'chevronRight'} />
        How I got this
        <span className={styles.methodScope}>{details.scope}</span>
      </button>

      <div id={panelId} className={`${styles.collapse} ${open ? styles.collapseOpen : ''}`}>
        <div className={styles.collapseInner}>
          {details.steps ? (
            <div className={styles.methodGrid}>
              <div className={styles.methodBlock}>
                <span className={styles.label}>In plain words</span>
                <ol className={styles.steps}>
                  {details.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div className={styles.methodBlock}>
                <span className={styles.label}>Filters used</span>
                {filters}
              </div>
              {query && (
                <div className={`${styles.methodBlock} ${styles.wide}`}>
                  <div className={styles.queryHead}>
                    <span className={styles.label}>Query</span>
                    <Button size="sm" variant="ghost" icon="copy" onClick={copy}>
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  {query}
                  <div className={styles.methodFooter}>
                    <span>Data as of {dataset.asOf} today</span>
                    <button
                      type="button"
                      className={styles.textLink}
                      onClick={() => toast.show('Thanks. We’ll check this number and reply here.')}
                    >
                      Something look wrong? Report this number
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.methodStack}>
              {details.description && <p className={styles.description}>{details.description}</p>}
              {filters}
              {query}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

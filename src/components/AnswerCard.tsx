import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './AnswerCard.module.css';

/** Renders "Referrals closed best at **19.4%**" with the key numbers emphasised. */
export function Emphasis({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className={styles.keyNumber}>
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

interface AnswerCardProps {
  /** Thread cards carry the question as their own heading. */
  question?: string;
  summary: string;
  headline?: { value: string; label: string };
  actions?: ReactNode;
  /** "Based on 268 leads created Jul 1 – Sep 30". */
  basis?: string;
  caveat?: string;
  followUps?: ReactNode;
  children?: ReactNode;
  id?: string;
}

export function AnswerCard({ question, summary, headline, actions, basis, caveat, followUps, children, id }: AnswerCardProps) {
  return (
    <article id={id} aria-label={question ? `Answer: ${question}` : 'Answer'} className={`${styles.card} answer-in`}>
      <div className={styles.body}>
        {(question || actions) && (
          <div className={styles.head}>
            {question && <h2 className={styles.title}>{question}</h2>}
            {actions && <div className={styles.actions}>{actions}</div>}
          </div>
        )}
        {headline && (
          <div className={styles.headline}>
            <span className={styles.headlineValue}>{headline.value}</span>
            <span className={styles.headlineLabel}>{headline.label}</span>
          </div>
        )}
        <p className={styles.summary}>
          <Emphasis text={summary} />
        </p>
        {caveat && (
          <p className={styles.caveat}>
            <Icon name="info" />
            <span>{caveat}</span>
          </p>
        )}
        {children}
      </div>
      {basis && <div className={styles.basis}>{basis}</div>}
      {followUps && <div className={styles.followUps}>{followUps}</div>}
    </article>
  );
}

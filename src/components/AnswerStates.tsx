import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, FilterChip, SuggestionChip } from './controls';
import { Icon, Spinner } from './Icon';
import styles from './AnswerStates.module.css';

/*
 * Every state keeps the question visible and says plainly what happened.
 * No state ever shows a number it can't explain.
 */

interface StateCardProps {
  question: string;
  children: ReactNode;
  role?: 'alert';
  busy?: boolean;
}

function StateCard({ question, children, role, busy }: StateCardProps) {
  return (
    <article role={role} aria-busy={busy || undefined} className={`${styles.card} answer-in`}>
      <h3 className={styles.question}>{question}</h3>
      {children}
    </article>
  );
}

/* ---------- Loading ---------- */

export interface LoadingStep {
  label: string;
  status: 'done' | 'active' | 'pending';
}

interface LoadingAnswerProps {
  question: string;
  steps: LoadingStep[];
  onStop?: () => void;
}

export function LoadingAnswer({ question, steps, onStop }: LoadingAnswerProps) {
  return (
    <StateCard question={question} busy>
      <div role="status" aria-live="polite" className={styles.steps}>
        {steps.map((step) => (
          <div key={step.label} className={`${styles.step} ${styles[step.status]}`}>
            {step.status === 'done' && <Icon name="check" className={styles.accent} />}
            {step.status === 'active' && <Spinner />}
            {step.status === 'pending' && <Icon name="pending" />}
            {step.label}
          </div>
        ))}
      </div>
      <div aria-hidden="true" className={styles.skeletonText}>
        <div className={styles.skeleton} style={{ width: '72%' }} />
        <div className={styles.skeleton} style={{ width: '48%' }} />
      </div>
      <div aria-hidden="true" className={styles.skeletonBars}>
        {[88, 64, 52, 30].map((width) => (
          <div key={width} className={styles.skeletonRow}>
            <div className={styles.skeleton} />
            <div className={`${styles.skeleton} ${styles.skeletonBar}`} style={{ width: `${width}%` }} />
            <div className={styles.skeleton} />
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <span>Usually 2–5 seconds.</span>
        {onStop && (
          <Button size="md" variant="ghost" onClick={onStop}>
            Stop
          </Button>
        )}
      </div>
    </StateCard>
  );
}

/* ---------- Ambiguous ---------- */

export interface Interpretation {
  label: string;
  unit: string;
  to: string;
}

interface AmbiguousAnswerProps {
  question: string;
  prompt: ReactNode;
  options: Interpretation[];
}

export function AmbiguousAnswer({ question, prompt, options }: AmbiguousAnswerProps) {
  return (
    <StateCard question={question}>
      <p className={styles.lead}>{prompt}</p>
      <div className={styles.options}>
        {options.map((option) => (
          <Link key={option.label} to={option.to} className={styles.option}>
            {option.label}
            <span className={styles.optionUnit}>{option.unit}</span>
          </Link>
        ))}
      </div>
      <span className={styles.footer}>Or rephrase in the box below.</span>
    </StateCard>
  );
}

/* ---------- No results ---------- */

interface NoResultsProps {
  question: string;
  explanation: string;
  filters: { label: string; changed?: boolean }[];
  suggestions: string[];
  onSuggestion?: (question: string) => void;
}

export function NoResults({ question, explanation, filters, suggestions, onSuggestion }: NoResultsProps) {
  return (
    <StateCard question={question}>
      <div className={styles.noneBlock}>
        <span className={styles.none}>None</span>
        <p className={styles.lead}>{explanation}</p>
      </div>
      <div className={styles.block}>
        <span className={styles.label}>Filters used</span>
        <div className={styles.chips}>
          {filters.map((filter) => (
            <FilterChip key={filter.label}>{filter.changed ? <strong>{filter.label}</strong> : filter.label}</FilterChip>
          ))}
        </div>
      </div>
      <div className={`${styles.chips} ${styles.pushDown}`}>
        {suggestions.map((suggestion) => (
          <SuggestionChip key={suggestion} onClick={() => onSuggestion?.(suggestion)}>
            {suggestion}
          </SuggestionChip>
        ))}
      </div>
    </StateCard>
  );
}

/* ---------- Error ---------- */

interface ErrorAnswerProps {
  question: string;
  title: string;
  detail: string;
  reference?: string;
  onRetry?: () => void;
  onFallback?: () => void;
}

export function ErrorAnswer({ question, title, detail, reference, onRetry, onFallback }: ErrorAnswerProps) {
  return (
    <StateCard question={question} role="alert">
      <ErrorNotice title={title} detail={detail} />
      <div className={styles.chips}>
        <Button variant="primary" size="lg" onClick={onRetry}>
          Try again
        </Button>
        <Button variant="secondary" size="lg" onClick={onFallback}>
          Use 7:00 AM data instead
        </Button>
      </div>
      {reference && <span className={styles.footer}>Your question is saved. Reference {reference}.</span>}
    </StateCard>
  );
}

export function ErrorNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.errorNotice}>
      <Icon name="error" className={styles.danger} />
      <div className={styles.errorText}>
        <strong className={styles.danger}>{title}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

/* ---------- Data can't answer it ---------- */

interface CantAnswerProps {
  question: string;
  explanation: string;
  related?: { question: string; to: string };
}

export function CantAnswer({ question, explanation, related }: CantAnswerProps) {
  return (
    <StateCard question={question}>
      <p className={styles.lead}>{explanation}</p>
      {related && (
        <div className={styles.block}>
          <span className={styles.label}>A related question I can answer</span>
          <Link to={related.to} className={styles.related}>
            {related.question}
            <Icon name="arrowRight" className={styles.accent} />
          </Link>
        </div>
      )}
      <details className={styles.footer}>
        <summary className={styles.footerLink}>What data can Pipeline see?</summary>
        <p className={styles.dataScope}>
          Leads, calls, texts, emails, appointments and deals from your CRM, refreshed daily at 7:00 AM.
        </p>
      </details>
    </StateCard>
  );
}

/* ---------- Empty board ---------- */

export function EmptyBoard() {
  return (
    <div className={styles.empty}>
      <Icon name="pin" size={24} />
      <strong className={styles.emptyTitle}>Nothing pinned yet</strong>
      <span className={styles.emptyText}>Pin any answer and it lands here, re-run every morning at 7:00 AM.</span>
      <Link to="/" className={styles.emptyAction}>
        Ask a question
      </Link>
    </div>
  );
}

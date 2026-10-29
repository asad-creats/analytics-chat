import { useEffect, useState } from 'react';
import { useConversations, type Turn } from '../state/conversations';
import { useSettings } from '../state/settings';
import { useToast } from '../state/toast';
import { AnswerCard } from './AnswerCard';
import { AnswerChart, AnswerTable } from './AnswerChart';
import { AmbiguousAnswer, CantAnswer, ErrorAnswer, LoadingAnswer, type LoadingStep } from './AnswerStates';
import { Button, PinButton, SuggestionChip } from './controls';
import styles from './AnswerView.module.css';

const STEP_MS = [1800, 4500];

/** The steps shown while an answer is being worked out. */
function useLoadingSteps(active: boolean, leadCount?: number): LoadingStep[] {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    setStep(0);
    const timers = STEP_MS.map((ms, i) => window.setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(window.clearTimeout);
  }, [active]);
  const labels = [
    'Understanding the question',
    leadCount ? `Reading ${leadCount.toLocaleString()} leads and their activity…` : 'Reading the CRM data…',
    'Writing the answer',
  ];
  return labels.map((label, i) => ({ label, status: i < step ? 'done' : i === step ? 'active' : 'pending' }));
}

function errorCopy(code: string): string {
  switch (code) {
    case 'daily_limit':
    case 'site_limit':
      return 'Free questions are used up';
    case 'llm_auth':
      return 'Your AI key didn’t work';
    case 'llm_rate_limit':
      return 'The AI service is busy';
    case 'llm_refused':
      return 'The AI declined this one';
    case 'not_configured':
      return 'The free demo isn’t set up yet';
    case 'not_connected':
      return 'Live data isn’t connected';
    case 'db_error':
      return 'I couldn’t reach the data';
    case 'interrupted':
      return 'This question didn’t finish';
    default:
      return 'I couldn’t work that out';
  }
}

interface AnswerViewProps {
  conversationId: string;
  turn: Turn;
}

export function AnswerView({ conversationId, turn }: AnswerViewProps) {
  const { askIn, retry, isPinned, togglePin } = useConversations();
  const { status, openSettings } = useSettings();
  const toast = useToast();
  const steps = useLoadingSteps(turn.status === 'pending', status?.lead_count);
  const askNext = (question: string) => askIn(conversationId, question);

  if (turn.status === 'pending') {
    return <LoadingAnswer question={turn.question} steps={steps} />;
  }

  if (turn.status === 'error' || !turn.answer) {
    const code = turn.error?.code ?? 'error';
    const needsKey = ['daily_limit', 'site_limit', 'not_configured', 'llm_auth'].includes(code);
    return (
      <ErrorAnswer
        question={turn.question}
        title={errorCopy(code)}
        detail={turn.error?.message ?? 'Something went wrong.'}
        actions={
          <>
            <Button variant="primary" size="lg" onClick={() => retry(conversationId, turn.id)}>
              Try again
            </Button>
            {needsKey && (
              <Button variant="secondary" size="lg" onClick={openSettings}>
                {code === 'llm_auth' ? 'Check AI settings' : 'Use your own key'}
              </Button>
            )}
          </>
        }
        footer="Nothing was guessed. Your question is saved."
      />
    );
  }

  const answer = turn.answer;

  if (answer.kind === 'clarify') {
    return (
      <AmbiguousAnswer
        question={turn.question}
        prompt={answer.summary}
        options={(answer.options ?? []).map((label) => ({ label }))}
        onChoose={askNext}
      />
    );
  }

  if (answer.kind === 'cannot_answer') {
    return <CantAnswer question={turn.question} explanation={answer.summary} related={answer.follow_ups.slice(0, 2)} onAsk={askNext} />;
  }

  const share = () => {
    const text = `${turn.question}\n${answer.summary.replace(/\*\*/g, '')}\n${answer.basis} (Pipeline demo, sample data)`;
    void navigator.clipboard?.writeText(text);
    toast.show('Answer copied.');
  };

  return (
    <AnswerCard
      question={turn.question}
      summary={answer.summary}
      headline={answer.headline}
      caveat={answer.caveat}
      basis={answer.basis}
      actions={
        <>
          <PinButton pinned={isPinned(turn.id)} onToggle={() => togglePin(turn)} />
          <Button size="md" variant="ghost" icon="share" aria-label="Copy answer" onClick={share} />
        </>
      }
      followUps={
        answer.follow_ups.length > 0 &&
        answer.follow_ups.map((q) => (
          <SuggestionChip key={q} onClick={() => askNext(q)}>
            {q}
          </SuggestionChip>
        ))
      }
    >
      {answer.chart && <AnswerChart chart={answer.chart} />}
      {answer.table && (
        <div className={styles.table}>
          {answer.table.title && <span className={styles.tableTitle}>{answer.table.title}</span>}
          <AnswerTable table={answer.table} />
        </div>
      )}
    </AnswerCard>
  );
}

import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AmbiguousAnswer, CantAnswer, LoadingAnswer, type LoadingStep } from '../components/AnswerStates';
import { TopBar } from '../components/AppShell';
import { Composer } from '../components/Composer';
import { dataset, resolveQuestion } from '../data/demo';
import { askPath } from '../routes';
import styles from './pages.module.css';

const stepLabels = ['Understood the question', `Reading ${dataset.leadCount} leads…`, 'Drawing the chart'];
const STEP_MS = 700;

/** Works a typed question out, then hands over to its answer or says why it can't. */
export function Ask() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const question = params.get('q')?.trim() ?? '';
  const [step, setStep] = useState(0);
  const [askedAt] = useState(() => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));

  useEffect(() => {
    setStep(0);
    const timers = stepLabels.map((_, i) => window.setTimeout(() => setStep(i + 1), STEP_MS * (i + 1)));
    return () => timers.forEach(window.clearTimeout);
  }, [question]);

  const done = step >= stepLabels.length;
  const resolution = resolveQuestion(question);

  if (!question) return <Navigate to="/" replace />;
  if (done && resolution.kind === 'answer') return <Navigate to={resolution.to} replace />;

  const steps: LoadingStep[] = stepLabels.map((label, i) => ({
    label,
    status: i < step ? 'done' : i === step ? 'active' : 'pending',
  }));

  return (
    <>
      <TopBar title="New question" />
      <div className={styles.center}>
        <div className={styles.column}>
          <div className={styles.asked}>
            <span className={styles.askedMeta}>You asked · {askedAt}</span>
            <h1 className={styles.questionTitle}>{question}</h1>
          </div>

          {!done && <LoadingAnswer question={question} steps={steps} onStop={() => navigate('/')} />}

          {done && resolution.kind === 'ambiguous' && (
            <AmbiguousAnswer
              question={question}
              prompt="“Doing” could mean a few things. Which number should I use?"
              options={[
                { label: 'Deals closed', unit: 'count', to: '/board#deals-closing' },
                { label: 'New leads', unit: 'count', to: '/board#new-leads' },
                { label: 'Response time', unit: 'minutes', to: '/thread/monday#response-slip' },
                { label: 'All four, side by side', unit: 'summary', to: '/board' },
              ]}
            />
          )}

          {done && resolution.kind === 'unknown' && (
            <CantAnswer
              question={question}
              explanation="I can’t answer that from this demo’s data. It knows about leads, calls, appointments and deals for one team, not much beyond that."
              related={{ question: 'Which lead sources closed best last quarter?', to: '/answer/lead-sources' }}
            />
          )}

          <div className={styles.composer}>
            <Composer
              label="Ask a follow-up"
              placeholder="Ask a follow-up…"
              busy={!done}
              busyText={stepLabels[Math.min(step, stepLabels.length - 1)]}
              onStop={() => navigate('/')}
              onSubmit={(next) => navigate(askPath(next))}
            />
          </div>
        </div>
      </div>
    </>
  );
}

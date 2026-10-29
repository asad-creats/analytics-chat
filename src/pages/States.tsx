import { TopBar } from '../components/AppShell';
import {
  AmbiguousAnswer,
  CantAnswer,
  ErrorAnswer,
  LoadingAnswer,
  NoResults,
} from '../components/AnswerStates';
import { useNavigate } from 'react-router-dom';
import { Button, DemoBadge } from '../components/controls';
import { useConversations } from '../state/conversations';
import { useToast } from '../state/toast';
import styles from './States.module.css';

/** Reference page for every answer state, as laid out in the design. Its choices ask for real. */
export function States() {
  const toast = useToast();
  const navigate = useNavigate();
  const { start } = useConversations();
  const ask = (question: string) => navigate(`/c/${start(question)}`);

  return (
    <>
      <TopBar title="Answer states" />
      <div className={styles.page}>
        <div className={styles.head}>
          <div className={styles.heading}>
            <h1 className={styles.title}>Answer states</h1>
            <p className={styles.lede}>
              Every state keeps the question visible and says plainly what happened. No state ever shows a number it
              can’t explain.
            </p>
          </div>
          <DemoBadge />
        </div>

        <div className={styles.grid}>
          <section aria-labelledby="state-loading" className={`${styles.cell} ${styles.wide}`}>
            <h2 id="state-loading" className={styles.label}>
              Loading
            </h2>
            <LoadingAnswer
              question="Which agents set the most appointments in October?"
              steps={[
                { label: 'Understood: appointments set, Oct 1–28, grouped by agent', status: 'done' },
                { label: 'Reading 412 leads…', status: 'active' },
                { label: 'Drawing the chart', status: 'pending' },
              ]}
              onStop={() => toast.show('Stopped. Your question is still in the box.')}
            />
          </section>

          <section aria-labelledby="state-ambiguous" className={styles.cell}>
            <h2 id="state-ambiguous" className={styles.label}>
              Ambiguous question
            </h2>
            <AmbiguousAnswer
              question="How are we doing this month?"
              prompt="“Doing” could mean a few things. Which number should I use?"
              options={[
                { label: 'How many deals closed this month?', unit: 'count' },
                { label: 'How many new leads came in this month?', unit: 'count' },
                { label: 'What was our median response time this month?', unit: 'minutes' },
              ]}
              onChoose={ask}
            />
          </section>

          <section aria-labelledby="state-none" className={styles.cell}>
            <h2 id="state-none" className={styles.label}>
              No results
            </h2>
            <NoResults
              question="Which deals over $900K closed in October?"
              explanation="No deal over $900,000 closed in October. 4 deals closed; the largest was $612,000."
              filters={[{ label: 'Closed: Oct 1–28' }, { label: 'Price > $900,000', changed: true }]}
              suggestions={['Show all 4 October closings', 'Try $500K+']}
              onSuggestion={ask}
            />
          </section>

          <section aria-labelledby="state-error" className={styles.cell}>
            <h2 id="state-error" className={styles.label}>
              Error
            </h2>
            <ErrorAnswer
              question="Which leads replied to a text today?"
              title="I couldn’t reach your CRM"
              detail="This question needs today’s text activity, and the connection timed out. I didn’t guess an answer."
              footer="Nothing was guessed. Your question is saved."
              actions={
                <Button variant="primary" size="lg" onClick={() => toast.show('This is the reference layout; nothing failed.')}>
                  Try again
                </Button>
              }
            />
          </section>

          <section aria-labelledby="state-cant" className={styles.cell}>
            <h2 id="state-cant" className={styles.label}>
              Data can’t answer it
            </h2>
            <CantAnswer
              question="Which agent is most likely to quit?"
              explanation="I can’t answer that from your CRM. It records leads, calls, appointments and deals, not how agents feel about their work."
              related={['Whose call activity dropped most in the last 30 days?']}
              onAsk={ask}
            />
          </section>
        </div>
      </div>
    </>
  );
}

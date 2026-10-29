import { useNavigate } from 'react-router-dom';
import { isConnected } from '../api/pipeline';
import { TopBar } from '../components/AppShell';
import { Composer } from '../components/Composer';
import { starterGroups } from '../data/starters';
import { useConversations } from '../state/conversations';
import styles from './Home.module.css';

export function Home() {
  const navigate = useNavigate();
  const { start } = useConversations();
  const ask = (question: string) => navigate(`/c/${start(question)}`);

  return (
    <>
      <TopBar title="New question" />
      <div className={styles.page}>
        <div className={styles.column}>
          <div className={styles.intro}>
            <h1 className={styles.title}>What do you want to know?</h1>
            <p className={styles.lede}>
              Ask about your leads, agents or deals in plain English. Answers are worked out from the live CRM data
              every time you ask.
            </p>
          </div>

          {!isConnected && (
            <p className={styles.notice}>
              Live data isn’t connected in this build yet. Set <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code>; the README has the steps.
            </p>
          )}

          <Composer
            variant="hero"
            label="Your question"
            placeholder="e.g. Which agents set the most appointments this month?"
            onSubmit={ask}
            autoFocus
          />

          <section aria-labelledby="suggestions" className={styles.suggestions}>
            <h2 id="suggestions" className={styles.suggestionsTitle}>
              Try one of these
            </h2>
            <div className={styles.groups}>
              {starterGroups.map((group) => (
                <div key={group.topic} className={styles.group}>
                  <div className={styles.topic}>
                    <span aria-hidden="true" className={styles.topicMark} />
                    {group.topic}
                  </div>
                  {group.questions.map((question) => (
                    <button key={question} type="button" className={styles.starter} onClick={() => ask(question)}>
                      {question}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

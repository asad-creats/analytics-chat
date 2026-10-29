import { Link, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/AppShell';
import { Composer } from '../components/Composer';
import { suggestionGroups } from '../data/demo';
import { askPath } from '../routes';
import styles from './Home.module.css';

export function Home() {
  const navigate = useNavigate();

  return (
    <>
      <TopBar title="New question" />
      <div className={styles.page}>
        <div className={styles.column}>
          <div className={styles.intro}>
            <h1 className={styles.title}>What do you want to know?</h1>
            <p className={styles.lede}>
              Ask about your leads, agents or deals in plain English. Every answer shows the numbers it used.
            </p>
          </div>

          <Composer
            variant="hero"
            label="Your question"
            placeholder="e.g. Which agents set the most appointments this month?"
            onSubmit={(question) => navigate(askPath(question))}
            autoFocus
          />

          <section aria-labelledby="suggestions" className={styles.suggestions}>
            <h2 id="suggestions" className={styles.suggestionsTitle}>
              Try one of these
            </h2>
            <div className={styles.groups}>
              {suggestionGroups.map((group) => (
                <div key={group.topic} className={styles.group}>
                  <div className={styles.topic}>
                    <span aria-hidden="true" className={styles.topicMark} />
                    {group.topic}
                  </div>
                  {group.items.map((item) => (
                    <Link key={item.question} to={item.to} className={styles.starter}>
                      {item.question}
                    </Link>
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

import { Link, useNavigate } from 'react-router-dom';
import { browserDemo, isConnected } from '../api/pipeline';
import { TopBar } from '../components/AppShell';
import { Composer } from '../components/Composer';
import { crmStatusLabel, syncedLabel } from '../components/crm';
import { Icon } from '../components/Icon';
import { starterGroups } from '../data/starters';
import { useConversations } from '../state/conversations';
import { useReports } from '../state/reports';
import { useSettings } from '../state/settings';
import { dailyPreset } from '../../supabase/functions/pipeline-ask/report.ts';
import styles from './Home.module.css';

export function Home() {
  const navigate = useNavigate();
  const { start } = useConversations();
  const { openSettings, status } = useSettings();
  const { generate } = useReports();
  const ask = (question: string) => navigate(`/c/${start(question)}`);
  const dailyReport = () => navigate(`/reports/${generate(dailyPreset)}`);

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

          {browserDemo && (
            <p className={styles.demoNote}>
              This demo runs entirely in your browser: a Postgres database of about 420 sample leads that keeps changing while
              you watch. The questions below answer without a key; to ask anything, add your own AI key in{' '}
              <button type="button" className={styles.inlineLink} onClick={openSettings}>
                AI settings
              </button>
              .
            </p>
          )}

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

        <aside className={styles.rail} aria-label="Reports and data">
          <div className={styles.railCard}>
            <h2 className={styles.railTitle}>Reports</h2>
            <button type="button" className={styles.railAction} onClick={dailyReport}>
              <Icon name="report" />
              <span>
                Daily report
                <small>Yesterday’s leads, speed to lead, what’s due</small>
              </span>
            </button>
            <Link to="/reports" className={styles.railAction}>
              <Icon name="sliders" />
              <span>
                Custom report
                <small>Pick a period, agent, sections and focus</small>
              </span>
            </Link>
          </div>

          <div className={styles.railCard}>
            <h2 className={styles.railTitle}>Data source</h2>
            {status ? (
              <>
                <strong>
                  {status.crm.name} · {crmStatusLabel[status.crm.status]}
                </strong>
                <dl className={styles.railStats}>
                  <div>
                    <dd className="tabular">{status.counts.leads.toLocaleString()}</dd>
                    <dt>Leads</dt>
                  </div>
                  <div>
                    <dd className="tabular">{status.counts.activities.toLocaleString()}</dd>
                    <dt>Calls, texts & notes</dt>
                  </div>
                  <div>
                    <dd className="tabular">{status.counts.appointments.toLocaleString()}</dd>
                    <dt>Appointments</dt>
                  </div>
                  <div>
                    <dd className="tabular">{status.counts.deals.toLocaleString()}</dd>
                    <dt>Deals</dt>
                  </div>
                </dl>
                <span className={styles.railLink}>Synced {syncedLabel(status)}</span>
              </>
            ) : (
              <span className={styles.railLink}>{isConnected ? 'Loading…' : 'Not connected'}</span>
            )}
            <Link to="/data" className={styles.railLink}>
              Where this data comes from
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

import { browserDemo } from '../api/pipeline';
import { TopBar } from '../components/AppShell';
import { FreshnessLine } from '../components/controls';
import { crmStatusLabel, crmTone, syncedLabel } from '../components/crm';
import { Icon } from '../components/Icon';
import { useSettings } from '../state/settings';
import styles from './DataSource.module.css';

const readable = [
  { what: 'Leads', detail: 'Name, source, stage, assigned agent, price range, when they came in' },
  { what: 'Activity', detail: 'Every call, text, email and note, inbound and outbound, with outcomes' },
  { what: 'Appointments', detail: 'Consultations, showings and listing appointments, with status' },
  { what: 'Deals', detail: 'Address, price, side, stage, contract and closing dates' },
  { what: 'Deadlines', detail: 'Inspection, appraisal, financing and title contingencies on open deals' },
  { what: 'Agents', detail: 'Who is on the team and active' },
];

const connectors = [
  { name: 'Follow Up Boss', state: 'Next', note: 'Syncs people, calls, texts, appointments and deals with an API key.' },
  { name: 'Lofty', state: 'Planned', note: '' },
  { name: 'BoldTrail (kvCORE)', state: 'Planned', note: '' },
  { name: 'CSV import', state: 'Planned', note: '' },
];

export function DataSource() {
  const { status, statusError, refreshStatus } = useSettings();
  const crm = status?.crm;
  const minutes = crm?.sync_every_minutes ?? 15;
  const cadence = minutes === 1 ? 'every minute' : `every ${minutes} minutes`;

  return (
    <>
      <TopBar title="Data source" />
      <div className={styles.page}>
        <div className={styles.head}>
          <h1 className={styles.title}>Data source</h1>
          <p className={styles.lede}>Where Pipeline’s answers come from, how fresh the data is, and what the AI can read.</p>
        </div>

        <div className={styles.grid}>
          <section className={`${styles.card} ${styles.connection}`} aria-labelledby="ds-connection">
            <h2 id="ds-connection" className={styles.cardLabel}>
              Connected CRM
            </h2>
            {statusError ? (
              <>
                <div className={styles.crmName}>
                  <Icon name="database" size={20} />
                  Not connected
                </div>
                <FreshnessLine state="stale">{statusError}</FreshnessLine>
                <button type="button" className={styles.retry} onClick={refreshStatus}>
                  Check again
                </button>
              </>
            ) : !status || !crm ? (
              <FreshnessLine state="refreshing">{browserDemo ? 'Loading the demo database…' : 'Checking the connection…'}</FreshnessLine>
            ) : (
              <>
                <div className={styles.crmName}>
                  <Icon name="database" size={20} />
                  {crm.name}
                  <span className={`${styles.pill} ${styles[`pill_${crmTone(crm.status)}`]}`}>{crmStatusLabel[crm.status]}</span>
                </div>
                {crm.account && <p className={styles.muted}>Account: {crm.account}</p>}
                <dl className={styles.facts}>
                  <div>
                    <dt>Last sync</dt>
                    <dd>{syncedLabel(status)}</dd>
                  </div>
                  <div>
                    <dt>Refreshes</dt>
                    <dd>{cadence}</dd>
                  </div>
                  <div>
                    <dt>Latest activity</dt>
                    <dd>
                      {status.last_activity_at
                        ? new Date(status.last_activity_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                        : '–'}
                    </dd>
                  </div>
                  <div>
                    <dt>Team time zone</dt>
                    <dd>{status.timezone.replace('_', ' ')}</dd>
                  </div>
                </dl>
                {crm.status === 'demo' && (
                  <p className={styles.note}>
                    {browserDemo
                      ? `This is a simulated CRM running in your browser: about 420 generated leads shaped like Follow Up Boss data, with a team that logs new leads and calls ${cadence}. Nothing here is real, and nothing leaves your browser except questions you send to your own AI key.`
                      : `This is a simulated CRM: generated leads shaped like Follow Up Boss data, with a team that logs new leads and calls ${cadence}. No real CRM is connected.`}
                  </p>
                )}
                {crm.status === 'error' && crm.last_error && <p className={styles.error}>{crm.last_error}</p>}
              </>
            )}
          </section>

          <section className={styles.card} aria-labelledby="ds-counts">
            <h2 id="ds-counts" className={styles.cardLabel}>
              What’s in it
            </h2>
            {status?.counts ? (
              <dl className={styles.counts}>
                {(
                  [
                    ['Leads', status.counts.leads],
                    ['Calls, texts, emails & notes', status.counts.activities],
                    ['Appointments', status.counts.appointments],
                    ['Deals', status.counts.deals],
                    ['Active agents', status.counts.agents],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dd className="tabular">{value.toLocaleString()}</dd>
                    <dt>{label}</dt>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.muted}>–</p>
            )}
          </section>

          <section className={styles.card} aria-labelledby="ds-read">
            <h2 id="ds-read" className={styles.cardLabel}>
              What the AI can read
            </h2>
            <ul className={styles.list}>
              {readable.map((r) => (
                <li key={r.what}>
                  <strong>{r.what}</strong>
                  <span>{r.detail}</span>
                </li>
              ))}
            </ul>
            <p className={styles.muted}>
              Read-only. The AI runs one lookup at a time against these records only; it can’t change data or see
              anything else.
            </p>
          </section>

          <section className={styles.card} aria-labelledby="ds-connect">
            <h2 id="ds-connect" className={styles.cardLabel}>
              Connect a CRM
            </h2>
            <ul className={styles.connectors}>
              {connectors.map((c) => (
                <li key={c.name}>
                  <div>
                    <strong>{c.name}</strong>
                    {c.note && <span>{c.note}</span>}
                  </div>
                  <span className={styles.state}>{c.state}</span>
                </li>
              ))}
            </ul>
            <p className={styles.muted}>
              Connectors write into the same tables the demo uses, so questions, reports and the board work unchanged.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

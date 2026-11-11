import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Emphasis } from '../components/AnswerCard';
import { AnswerChart, AnswerTable } from '../components/AnswerChart';
import { ErrorAnswer, LoadingAnswer } from '../components/AnswerStates';
import { TopBar } from '../components/AppShell';
import { Button } from '../components/controls';
import { Icon } from '../components/Icon';
import { useReports } from '../state/reports';
import { useSettings } from '../state/settings';
import { periods, sections } from '../../supabase/functions/pipeline-ask/report.ts';
import { reportTitle } from './Reports';
import styles from './Reports.module.css';

export function ReportView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { get, retry, remove } = useReports();
  const { status, openSettings } = useSettings();
  const entry = get(id);

  if (!entry) return <Navigate to="/reports" replace />;
  const title = reportTitle(entry);

  if (entry.status === 'pending') {
    return (
      <>
        <TopBar title={title} />
        <div className={styles.reportPage}>
          <LoadingAnswer
            question={`${title} · ${periods[entry.options.period]}`}
            steps={entry.options.sections.map((s, i) => ({
              label: sections[s].label,
              status: i === 0 ? 'active' : 'pending',
            }))}
          />
        </div>
      </>
    );
  }

  if (entry.status === 'error' || !entry.report) {
    const code = entry.error?.code ?? 'error';
    return (
      <>
        <TopBar title={title} />
        <div className={styles.reportPage}>
          <ErrorAnswer
            question={`${title} · ${periods[entry.options.period]}`}
            title="The report didn’t finish"
            detail={entry.error?.message ?? 'Something went wrong.'}
            actions={
              <>
                <Button variant="primary" size="lg" onClick={() => retry(entry.id)}>
                  Try again
                </Button>
                {['daily_limit', 'site_limit', 'not_configured', 'llm_auth'].includes(code) && (
                  <Button variant="secondary" size="lg" onClick={openSettings}>
                    {code === 'llm_auth' ? 'Check AI settings' : 'Add your own key'}
                  </Button>
                )}
              </>
            }
          />
        </div>
      </>
    );
  }

  const { report, meta } = entry;
  const generated = new Date(entry.requestedAt).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const writer =
    meta?.mode === 'sample' ? 'Sample, no AI' : meta?.mode === 'free' ? `Free tier · ${meta.model}` : meta ? `${meta.provider} · ${meta.model}` : '';

  return (
    <>
      <TopBar title={title} />
      <article className={`${styles.reportPage} answer-in`} aria-labelledby="report-title">
        <div className={styles.reportHead}>
          <div>
            <h1 id="report-title" className={styles.title}>
              {report.title}
            </h1>
            <p className={styles.reportMeta}>
              {report.period_label}
              {entry.options.agent ? ` · ${entry.options.agent}` : ' · Whole team'}
            </p>
            <p className={styles.reportMeta}>
              Generated {generated} · {status?.crm?.name ?? 'CRM'} data · {writer}
            </p>
          </div>
          <div className={`${styles.reportActions} no-print`}>
            <Button icon="refresh" onClick={() => retry(entry.id)}>
              Regenerate
            </Button>
            <Button icon="share" onClick={() => window.print()}>
              Print / PDF
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                remove(entry.id);
                navigate('/reports');
              }}
            >
              Delete
            </Button>
          </div>
        </div>

        {entry.options.focus && (
          <p className={styles.focus}>
            <Icon name="info" />
            <span>
              Looking for: <strong>{entry.options.focus}</strong>
            </span>
          </p>
        )}

        <section className={styles.highlights} aria-labelledby="highlights">
          <h2 id="highlights" className={styles.legend}>
            What stands out
          </h2>
          <ol>
            {report.highlights.map((h, i) => (
              <li key={i}>
                <Emphasis text={h} />
              </li>
            ))}
          </ol>
        </section>

        <div className={styles.sectionGrid}>
          {report.sections.map((s, i) => (
            <section key={i} className={`${styles.reportSection} ${s.table && s.table.columns.length > 3 ? styles.wide : ''}`}>
              <h2 className={styles.sectionHeading}>{s.heading}</h2>
              {s.headline && (
                <div className={styles.sectionHeadline}>
                  <span>{s.headline.value}</span>
                  <span>{s.headline.label}</span>
                </div>
              )}
              <p className={styles.sectionSummary}>
                <Emphasis text={s.summary} />
              </p>
              {s.caveat && <p className={styles.caveat}>{s.caveat}</p>}
              {s.chart && <AnswerChart chart={s.chart} />}
              {s.table && (
                <div className={styles.tableBlock}>
                  {s.table.title && <span className={styles.tableTitle}>{s.table.title}</span>}
                  <AnswerTable table={s.table} />
                </div>
              )}
              {s.basis && <p className={styles.sectionBasis}>{s.basis}</p>}
            </section>
          ))}
        </div>

        <p className={styles.reportBasis}>{report.basis}</p>
      </article>
    </>
  );
}

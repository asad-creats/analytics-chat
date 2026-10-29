import { useNavigate } from 'react-router-dom';
import { AnswerCard, LinkedNumber } from '../components/AnswerCard';
import { TopBar } from '../components/AppShell';
import { ChartFigure, HBarChart } from '../components/charts';
import { Composer } from '../components/Composer';
import { SuggestionChip } from '../components/controls';
import { closeRate, leadSources, leadSourcesQuery } from '../data/demo';
import { askPath } from '../routes';
import styles from './pages.module.css';

const followUps = [
  'Break this down by agent',
  'Compare to Q2',
  'Show the 6 referral leads that closed',
  'How long did each source take to close?',
];

export function Answer() {
  const navigate = useNavigate();
  const ask = (question: string) => navigate(askPath(question));
  const total = leadSources.reduce((sum, row) => sum + row.leads, 0);

  const rows = leadSources.map((row) => ({
    label: row.source,
    sub: `${row.closed} of ${row.leads} leads`,
    value: closeRate(row),
    display: <LinkedNumber>{closeRate(row)}%</LinkedNumber>,
  }));

  return (
    <>
      <TopBar title="Lead sources · Q3" />
      <div className={styles.center}>
        <div className={styles.column}>
          <div className={styles.asked}>
            <span className={styles.askedMeta}>You asked · 8:14 AM</span>
            <h1 className={styles.questionTitle}>Which lead sources closed best last quarter?</h1>
          </div>

          <AnswerCard
            pinId="lead-sources"
            methodOpen
            summary={
              <>
                Referrals closed best: <LinkedNumber>19.4%</LinkedNumber> of referral leads became closed deals (6 of
                31), about 3× Zillow’s <LinkedNumber>6.5%</LinkedNumber>. Zillow matched it on closings (6 each)
                because it sent three times as many leads.
              </>
            }
            method={{
              scope: `${total} leads checked · 0.4 s`,
              steps: [
                `Took every lead created Jul 1 – Sep 30, 2026: ${total} leads.`,
                'Grouped them by the “Source” field in your CRM.',
                'Close rate = leads now in the “Closed” stage ÷ all leads from that source.',
              ],
              filters: [
                'Created: Jul 1 – Sep 30, 2026',
                'Agents: all 9',
                'Left out: 6 duplicate leads',
                'Closed = stage “Closed”',
              ],
              query: leadSourcesQuery,
            }}
          >
            <ChartFigure
              padded
              title="Close rate by lead source"
              subtitle="Leads created Jul 1 – Sep 30, 2026 · share that reached Closed"
              chartLabel="Bar"
              chart={
                <HBarChart
                  rows={rows}
                  max={20}
                  ariaLabel="Horizontal bar chart. Referral 19.4 percent, Zillow 6.5, Website 4.7, Open house 3.7, Facebook ads 1.9."
                  ticks={[0, 5, 10, 15, 20].map((value) => ({ value, label: `${value}%` }))}
                  axisTitles={{ rows: 'Lead source', values: 'Close rate' }}
                  annotation={{ row: 1, text: 'Referral closes ≈3× as often' }}
                />
              }
              table={{
                columns: [
                  { key: 'source', label: 'Lead source' },
                  { key: 'leads', label: 'Leads', align: 'right' },
                  { key: 'closed', label: 'Closed', align: 'right' },
                  { key: 'rate', label: 'Close rate', align: 'right', strong: true },
                ],
                rows: leadSources.map((row) => ({
                  source: row.source,
                  leads: row.leads,
                  closed: row.closed,
                  rate: `${closeRate(row)}%`,
                })),
              }}
            />
          </AnswerCard>

          <div className={styles.followUps}>
            <span className={styles.followUpsLabel}>Ask next</span>
            <div className={styles.chips}>
              {followUps.map((question) => (
                <SuggestionChip key={question} onClick={() => ask(question)}>
                  {question}
                </SuggestionChip>
              ))}
            </div>
          </div>

          <div className={styles.composer}>
            <Composer label="Ask a follow-up" placeholder="Ask a follow-up…" onSubmit={ask} />
          </div>
        </div>
      </div>
    </>
  );
}

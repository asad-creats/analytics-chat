import { useNavigate } from 'react-router-dom';
import { AnswerCard, LinkedNumber } from '../components/AnswerCard';
import { TopBar } from '../components/AppShell';
import { ChartFigure, DataTable, HBarChart, LineChart } from '../components/charts';
import { Composer } from '../components/Composer';
import { FilterChip, SuggestionChip } from '../components/controls';
import { Icon } from '../components/Icon';
import {
  closeRate,
  leadSources,
  months,
  responseBySegment,
  uncalledByAgent,
  uncalledLeads,
  uncalledQuery,
} from '../data/demo';
import { askPath } from '../routes';
import pageStyles from './pages.module.css';
import styles from './Thread.module.css';

export function Thread() {
  const navigate = useNavigate();
  const ask = (question: string) => navigate(askPath(question));

  const monthTable = months.map((month, i) => ({
    month: i === months.length - 1 ? `${month} (to date)` : month,
    daytime: responseBySegment.daytime[i],
    evening: responseBySegment.evening[i],
  }));

  return (
    <>
      <TopBar title="Monday team check-in · 3 questions" />
      <div className={`${pageStyles.center} ${styles.center}`}>
        <div className={`${pageStyles.column} ${styles.column}`}>
          {/* 1 · Pinned, condensed */}
          <AnswerCard
            id="lead-sources"
            variant="thread"
            question="Which lead sources closed best last quarter?"
            pinId="lead-sources"
            summary={
              <>
                Referrals closed best at <LinkedNumber>19.4%</LinkedNumber>, about 3× Zillow’s{' '}
                <LinkedNumber>6.5%</LinkedNumber>.
              </>
            }
            method={{
              scope: '268 leads · Jul 1 – Sep 30',
              description:
                'Took every lead created Jul 1 – Sep 30, 2026, grouped them by Source, and divided leads now in the “Closed” stage by all leads from that source.',
              filters: ['Created: Jul 1 – Sep 30, 2026', 'Left out: 6 duplicate leads', 'Closed = stage “Closed”'],
            }}
          >
            <HBarChart
              density="compact"
              max={20}
              ariaLabel="Close rate by source: Referral 19.4%, Zillow 6.5%, Website 4.7%, Open house 3.7%, Facebook ads 1.9%"
              rows={leadSources.map((row) => ({ label: row.source, value: closeRate(row), display: `${closeRate(row)}%` }))}
            />
          </AnswerCard>

          {/* 2 · Table answer */}
          <div className={styles.turn}>
            <span className={pageStyles.askedMeta}>You asked · 8:21 AM</span>
            <AnswerCard
              id="uncalled"
              variant="thread"
              question="Who hasn't called their new leads this week?"
              pinId="uncalled"
              methodOpen
              summary={
                <>
                  <LinkedNumber>6 new leads</LinkedNumber> from this week have no call logged yet. Jordan Reyes has{' '}
                  <LinkedNumber>3</LinkedNumber> of them, including the longest wait: 2 days 1 hour.
                </>
              }
              method={{
                scope: '38 new leads checked',
                description:
                  'Took the 38 leads created Mon Oct 26 – now, and kept the ones with no outbound call logged. Texts and emails don’t count as a call.',
                filters: ['Created: this week (Mon–Thu)', 'Call = outbound call activity', 'Calls logged up to 7:00 AM'],
                query: uncalledQuery,
              }}
            >
              <div className={styles.chips}>
                {uncalledByAgent.map((row) => (
                  <FilterChip key={row.agent}>
                    {row.agent} <strong>{row.count}</strong>
                  </FilterChip>
                ))}
              </div>
              <DataTable
                caption="New leads with no call logged"
                minWidth={680}
                columns={[
                  { key: 'name', label: 'Lead' },
                  { key: 'agent', label: 'Agent' },
                  { key: 'phone', label: 'Phone', muted: true },
                  { key: 'email', label: 'Email', muted: true },
                  { key: 'cameIn', label: 'Came in', muted: true },
                  { key: 'waiting', label: 'Waiting', align: 'right' },
                ]}
                rows={uncalledLeads.map((lead, i) => ({
                  ...lead,
                  phone: <span className="tabular">{lead.phone}</span>,
                  waiting: i === 0 ? <strong>{lead.waiting}</strong> : lead.waiting,
                }))}
              />
            </AnswerCard>
          </div>

          {/* 3 · Line chart, honest about cause */}
          <div className={styles.turn}>
            <span className={pageStyles.askedMeta}>You asked · 8:26 AM</span>
            <AnswerCard
              id="response-slip"
              variant="thread"
              question="Why did response time slip in September?"
              pinId="response-slip"
              summary={
                <>
                  Median first response went from <LinkedNumber>10 min</LinkedNumber> in August to{' '}
                  <LinkedNumber>27 min</LinkedNumber> in September. Nearly all of the slip came from leads arriving
                  after 6 PM, which jumped from 12 to <LinkedNumber>61 min</LinkedNumber>; daytime held at 9 min.
                </>
              }
              method={{
                scope: 'First call, text or email after a lead was created',
                description:
                  'For every new lead Jun 1 – Oct 29, measured the time from creation to the first outbound call, text or email, then took the median per month, split at 6 PM.',
                filters: ['Created: Jun 1 – Oct 29, 2026', 'Evening = created after 6 PM', 'October is month to date'],
              }}
              followUps={[
                'Who handled evening leads in September?',
                'Break this down by agent',
                'Compare to last month',
              ].map((question) => (
                <SuggestionChip key={question} onClick={() => ask(question)}>
                  {question}
                </SuggestionChip>
              ))}
            >
              <p className={styles.caveat}>
                <Icon name="info" />
                <span>
                  Your CRM shows when the slip happened, not why. A change in evening coverage would explain it, but I
                  can’t confirm that from this data.
                </span>
              </p>
              <ChartFigure
                title="Median minutes to first response, by month"
                subtitle="All new leads · Jun 1 – Oct 29, 2026 · October is month to date"
                chartLabel="Line"
                chart={
                  <LineChart
                    categories={[...months.slice(0, -1), 'Oct (to date)']}
                    series={[
                      { label: 'Daytime', values: responseBySegment.daytime, slot: 1 },
                      { label: 'After 6 PM', values: responseBySegment.evening, slot: 2 },
                    ]}
                    domainMax={68.5}
                    ticks={[0, 20, 40, 60]}
                    yTitle="Minutes"
                    focus={3}
                    callout={{ series: 1, index: 3, title: '61 min', detail: 'evening, Sep (was 12)' }}
                    ariaLabel="Line chart. Daytime leads: 8, 9, 9, 9, 9 minutes from June to October. Evening leads: 11, 13, 12, 61, 22 minutes."
                  />
                }
                table={{
                  columns: [
                    { key: 'month', label: 'Month' },
                    { key: 'daytime', label: 'Daytime (min)', align: 'right' },
                    { key: 'evening', label: 'After 6 PM (min)', align: 'right' },
                  ],
                  rows: monthTable,
                }}
              />
            </AnswerCard>
          </div>

          <Composer label="Ask another question" placeholder="Ask another question…" onSubmit={ask} />
        </div>
      </div>
    </>
  );
}

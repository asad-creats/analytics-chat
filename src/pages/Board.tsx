import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TopBar } from '../components/AppShell';
import { EmptyBoard } from '../components/AnswerStates';
import { BoardCard, BoardList } from '../components/BoardCard';
import { ColumnChart, HBarChart, LineChart } from '../components/charts';
import { Button } from '../components/controls';
import {
  appointmentsByAgent,
  closeRate,
  dealsClosing,
  leadSources,
  months,
  newLeadsByDay,
  responseBySegment,
  teamMedianResponse,
  uncalledByAgent,
} from '../data/demo';
import { usePins, type PinId } from '../state/pins';
import { useToast } from '../state/toast';
import styles from './Board.module.css';

export function Board() {
  const { pinned } = usePins();
  const toast = useToast();
  const boardRef = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [appointmentsStale, setAppointmentsStale] = useState(true);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const refresh = (after?: () => void) => {
    setRefreshing(true);
    timer.current = window.setTimeout(() => {
      setRefreshing(false);
      after?.();
      toast.show('Board refreshed. Data as of 7:00 AM.');
    }, 1200);
  };

  const present = () => {
    void boardRef.current?.requestFullscreen?.().catch(() => toast.show('Full screen isn’t available here.'));
  };

  const note = refreshing ? 'Refreshing…' : undefined;

  const cards: Record<PinId, ReactNode> = {
    'lead-sources': (
      <BoardCard
        pinId="lead-sources"
        title="Best-closing lead source · Q3"
        figure="19.4%"
        context="Referral close rate"
        to="/answer/lead-sources"
        note={note}
      >
        <HBarChart
          density="mini"
          max={20}
          ariaLabel="Referral 19.4%, Zillow 6.5%, Website 4.7%, Open house 3.7%, Facebook ads 1.9%"
          rows={leadSources.map((row) => ({ label: row.short, value: closeRate(row), display: `${closeRate(row)}%` }))}
        />
      </BoardCard>
    ),
    'new-leads': (
      <BoardCard
        pinId="new-leads"
        title="New leads this week"
        figure="38"
        context="Mon–Thu · 31 the same days last week"
        note={note ?? '*Thu up to 7:00 AM'}
      >
        <ColumnChart
          columns={newLeadsByDay}
          max={14}
          height={72}
          emphasis={0}
          ariaLabel="Mon 14, Tue 11, Wed 10, Thu 3 so far"
        />
      </BoardCard>
    ),
    uncalled: (
      <BoardCard
        pinId="uncalled"
        title="New leads with no call yet"
        figure="6"
        context="longest wait 2d 1h"
        to="/thread/monday#uncalled"
        note={note}
      >
        <BoardList rows={uncalledByAgent.map((row) => ({ label: row.agent, value: row.count }))} />
      </BoardCard>
    ),
    'median-response': (
      <BoardCard
        pinId="median-response"
        title="Median first response · October"
        figure="14 min"
        context="down from 27 in Sep"
        to="/thread/monday#response-slip"
        note={note}
      >
        <LineChart
          variant="mini"
          categories={months}
          series={[{ label: 'Team median', values: teamMedianResponse, slot: 1 }]}
          domainMax={38}
          labelled={[3, 4]}
          ariaLabel="Median minutes by month: Jun 9, Jul 11, Aug 10, Sep 27, Oct 14"
        />
      </BoardCard>
    ),
    'deals-closing': (
      <BoardCard
        pinId="deals-closing"
        title="Deals closing in the next 14 days"
        figure="5"
        context="2 need action this week"
        note={note}
      >
        <BoardList
          rows={dealsClosing.map((deal) => ({
            extra: <span className={styles.date}>{deal.date}</span>,
            label: deal.address,
            value: <span className={deal.urgent ? styles.urgent : styles.status}>{deal.status}</span>,
          }))}
        />
      </BoardCard>
    ),
    appointments: (
      <BoardCard
        pinId="appointments"
        title="Appointments set this week"
        figure="14"
        context={appointmentsStale ? 'as of yesterday' : 'Mon–Thu'}
        note={note}
        stale={
          appointmentsStale && !refreshing
            ? { message: 'Today’s refresh failed · showing Wed 7:00 AM', onRetry: () => refresh(() => setAppointmentsStale(false)) }
            : undefined
        }
      >
        <HBarChart
          density="mini"
          max={5}
          ariaLabel="Priya Shah 5, Jordan Reyes 3, Marcus Bell 2, 6 other agents 4"
          rows={appointmentsByAgent.map((row) => ({
            label: row.label,
            value: row.value,
            display: row.value,
            slot: row.other ? 5 : 1,
          }))}
        />
      </BoardCard>
    ),
    'response-slip': (
      <BoardCard
        pinId="response-slip"
        title="Evening first response · by month"
        figure="22 min"
        context="after 6 PM · down from 61 in Sep"
        to="/thread/monday#response-slip"
        note={note}
      >
        <LineChart
          variant="mini"
          categories={months}
          series={[{ label: 'After 6 PM', values: responseBySegment.evening, slot: 2 }]}
          domainMax={76}
          labelled={[3, 4]}
          ariaLabel="Evening median minutes by month: Jun 11, Jul 13, Aug 12, Sep 61, Oct 22"
        />
      </BoardCard>
    ),
  };

  return (
    <>
      <TopBar title="Pinned board" />
      <div ref={boardRef} className={styles.page}>
        <div className={styles.head}>
          <div className={styles.heading}>
            <h1 className={styles.title}>Morning board</h1>
            <span className={styles.subtitle}>
              {pinned.length} pinned {pinned.length === 1 ? 'answer' : 'answers'} · each re-runs its query every day
              at 7:00 AM
            </span>
          </div>
          <div className={styles.actions}>
            <Button icon="refresh" onClick={() => refresh(() => setAppointmentsStale(false))} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </Button>
            <Button icon="share" onClick={present}>
              Present
            </Button>
          </div>
        </div>

        {pinned.length === 0 ? (
          <EmptyBoard />
        ) : (
          <div className={styles.grid}>
            {pinned.map((id) => (
              <div key={id} className={styles.cell}>
                {cards[id]}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

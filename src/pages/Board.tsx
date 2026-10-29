import { useRef, useState } from 'react';
import type { Answer } from '../api/pipeline';
import { Emphasis } from '../components/AnswerCard';
import { ChartBody, formatValue } from '../components/AnswerChart';
import { TopBar } from '../components/AppShell';
import { EmptyBoard } from '../components/AnswerStates';
import { BoardCard, BoardList } from '../components/BoardCard';
import { Button } from '../components/controls';
import { useConversations, type Pin } from '../state/conversations';
import { useToast } from '../state/toast';
import styles from './Board.module.css';

/** The big number on a card: the answer's headline, else its top value. */
function figureFor(answer: Answer): { figure: string; context: string } {
  if (answer.headline) return { figure: answer.headline.value, context: answer.headline.label };
  const top = answer.chart?.series[0]?.points[0];
  if (top) return { figure: formatValue(top.value, answer.chart?.unit), context: top.label };
  if (answer.table) return { figure: String(answer.table.rows.length), context: answer.table.title ?? answer.title };
  return { figure: '–', context: answer.title };
}

function CardBody({ answer }: { answer: Answer }) {
  if (answer.chart) return <ChartBody chart={answer.chart} size="compact" />;
  if (answer.table && answer.table.rows.length > 0) {
    return (
      <BoardList
        rows={answer.table.rows.slice(0, 5).map((row) => ({
          label: row[0],
          value: row.length > 1 ? row[row.length - 1] : '',
        }))}
      />
    );
  }
  return (
    <p className={styles.summary}>
      <Emphasis text={answer.summary} />
    </p>
  );
}

const updated = (pin: Pin) => {
  const at = new Date(pin.refreshedAt);
  const sameDay = at.toDateString() === new Date().toDateString();
  return `Updated ${sameDay ? '' : `${at.toLocaleDateString([], { month: 'short', day: 'numeric' })} `}${at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

export function Board() {
  const { pins, unpin, refreshPin, conversations } = useConversations();
  const toast = useToast();
  const boardRef = useRef<HTMLDivElement>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const conversationFor = (turnId: string) => conversations.find((c) => c.turns.some((t) => t.id === turnId));

  // One at a time, so the free tier's per-minute limits aren't hit all at once.
  const refreshAll = async () => {
    setRefreshingAll(true);
    for (const pin of pins) await refreshPin(pin.id);
    setRefreshingAll(false);
    toast.show('Board refreshed with the latest data.');
  };

  const present = () => {
    void boardRef.current?.requestFullscreen?.().catch(() => toast.show('Full screen isn’t available here.'));
  };

  return (
    <>
      <TopBar title="Pinned board" />
      <div ref={boardRef} className={styles.page}>
        <div className={styles.head}>
          <div className={styles.heading}>
            <h1 className={styles.title}>Morning board</h1>
            <span className={styles.subtitle}>
              {pins.length} pinned {pins.length === 1 ? 'answer' : 'answers'} · refresh to re-run them on the latest data
            </span>
          </div>
          {pins.length > 0 && (
            <div className={styles.actions}>
              <Button icon="refresh" onClick={refreshAll} disabled={refreshingAll}>
                {refreshingAll ? 'Refreshing…' : 'Refresh all'}
              </Button>
              <Button icon="share" onClick={present}>
                Present
              </Button>
            </div>
          )}
        </div>

        {pins.length === 0 ? (
          <EmptyBoard />
        ) : (
          <div className={styles.grid}>
            {pins.map((pin) => {
              const { figure, context } = figureFor(pin.answer);
              const conversation = conversationFor(pin.id);
              return (
                <div key={pin.id} className={styles.cell}>
                  <BoardCard
                    id={pin.id}
                    title={pin.question}
                    figure={figure}
                    context={context}
                    to={conversation ? `/c/${conversation.id}` : undefined}
                    note={pin.status === 'refreshing' ? 'Refreshing…' : updated(pin)}
                    stale={
                      pin.status === 'failed'
                        ? { message: `Refresh failed · showing ${updated(pin).toLowerCase()}`, onRetry: () => refreshPin(pin.id) }
                        : undefined
                    }
                    onUnpin={() => unpin(pin.id)}
                  >
                    <CardBody answer={pin.answer} />
                  </BoardCard>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

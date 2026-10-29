import { useEffect, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AnswerView } from '../components/AnswerView';
import { TopBar } from '../components/AppShell';
import { Composer } from '../components/Composer';
import { useConversations } from '../state/conversations';
import styles from './pages.module.css';

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function Conversation() {
  const { id = '' } = useParams();
  const { get, askIn } = useConversations();
  const conversation = get(id);
  const lastTurn = useRef<HTMLDivElement>(null);
  const turnCount = conversation?.turns.length ?? 0;

  // Bring each new question into view.
  useEffect(() => {
    if (turnCount > 1) lastTurn.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [turnCount]);

  if (!conversation) return <Navigate to="/" replace />;

  const turns = conversation.turns;
  const latest = turns[turns.length - 1];
  const busy = latest?.status === 'pending';
  const title = [...turns].reverse().find((t) => t.answer?.kind === 'answer')?.answer?.title ?? 'New question';

  return (
    <>
      <TopBar title={turns.length > 1 ? `${title} · ${turns.length} questions` : title} />
      <div className={styles.center}>
        <div className={`${styles.column} ${styles.thread}`}>
          {turns.map((turn, i) => (
            <div key={turn.id} ref={i === turns.length - 1 ? lastTurn : undefined} className={styles.turn}>
              <span className={styles.askedMeta}>You asked · {time(turn.askedAt)}</span>
              <AnswerView conversationId={conversation.id} turn={turn} />
            </div>
          ))}

          <div className={styles.composer}>
            <Composer
              label="Ask a follow-up"
              placeholder="Ask a follow-up…"
              busy={busy}
              busyText="Working it out…"
              onSubmit={(question) => askIn(conversation.id, question)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

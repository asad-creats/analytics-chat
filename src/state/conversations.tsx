import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ask, AskError, type Answer, type AnswerMeta } from '../api/pipeline';
import { useSettings } from './settings';
import { load, save } from './storage';
import { useToast } from './toast';

export interface Turn {
  id: string;
  question: string;
  askedAt: string;
  status: 'pending' | 'done' | 'error';
  answer?: Answer;
  meta?: AnswerMeta;
  error?: { code: string; message: string };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: Turn[];
}

/** A pinned question. Pinning keeps the question; refreshing re-asks it against today's data. */
export interface Pin {
  id: string;
  question: string;
  answer: Answer;
  meta?: AnswerMeta;
  pinnedAt: string;
  refreshedAt: string;
  status: 'idle' | 'refreshing' | 'failed';
}

const CONVERSATIONS_KEY = 'pipeline.conversations';
const PINS_KEY = 'pipeline.pins';
const MAX_CONVERSATIONS = 30;

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const now = () => new Date().toISOString();

function restore(): Conversation[] {
  // A question that was in flight when the page closed never got its answer.
  return load<Conversation[]>(CONVERSATIONS_KEY, []).map((c) => ({
    ...c,
    turns: c.turns.map((t) =>
      t.status === 'pending' ? { ...t, status: 'error', error: { code: 'interrupted', message: 'This question was interrupted.' } } : t,
    ),
  }));
}

interface ConversationsValue {
  conversations: Conversation[];
  get: (id: string) => Conversation | undefined;
  /** Starts a conversation with this question and returns its id. */
  start: (question: string) => string;
  askIn: (conversationId: string, question: string) => void;
  retry: (conversationId: string, turnId: string) => void;

  pins: Pin[];
  isPinned: (turnId: string) => boolean;
  togglePin: (turn: Turn) => void;
  unpin: (pinId: string) => void;
  refreshPin: (pinId: string) => Promise<void>;
}

const ConversationsContext = createContext<ConversationsValue | null>(null);

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>(restore);
  const [pins, setPins] = useState<Pin[]>(() =>
    load<Pin[]>(PINS_KEY, []).map((p) => ({ ...p, status: p.status === 'refreshing' ? 'idle' : p.status })),
  );
  const { ownKey, setFreeUsage, refreshStatus } = useSettings();
  const toast = useToast();

  // Always read the latest list inside async callbacks.
  const latest = useRef(conversations);
  latest.current = conversations;

  useEffect(() => save(CONVERSATIONS_KEY, conversations), [conversations]);
  useEffect(() => save(PINS_KEY, pins), [pins]);

  const patchTurn = useCallback((conversationId: string, turnId: string, patch: Partial<Turn>) => {
    setConversations((list) =>
      list.map((c) =>
        c.id === conversationId
          ? { ...c, updatedAt: now(), turns: c.turns.map((t) => (t.id === turnId ? { ...t, ...patch } : t)) }
          : c,
      ),
    );
  }, []);

  const run = useCallback(
    (conversationId: string, turnId: string, question: string) => {
      const conversation = latest.current.find((c) => c.id === conversationId);
      const history = (conversation?.turns ?? [])
        .filter((t) => t.id !== turnId && t.status === 'done' && t.answer)
        .map((t) => ({ question: t.question, summary: t.answer!.summary }));

      ask(question, history, ownKey)
        .then(({ answer, meta }) => {
          patchTurn(conversationId, turnId, { status: 'done', answer, meta, error: undefined });
          if (meta.usage) setFreeUsage(meta.usage);
          refreshStatus();
        })
        .catch((e: unknown) => {
          const error = e instanceof AskError ? e : new AskError('error', 'Something went wrong.');
          if (error.code === 'daily_limit' && typeof error.detail.limit === 'number') {
            setFreeUsage({ used: Number(error.detail.used ?? error.detail.limit), limit: error.detail.limit });
          }
          patchTurn(conversationId, turnId, { status: 'error', error: { code: error.code, message: error.message } });
        });
    },
    [ownKey, patchTurn, setFreeUsage, refreshStatus],
  );

  const askIn = useCallback(
    (conversationId: string, question: string) => {
      const turn: Turn = { id: newId(), question, askedAt: now(), status: 'pending' };
      const list = latest.current.map((c) =>
        c.id === conversationId ? { ...c, updatedAt: now(), turns: [...c.turns, turn] } : c,
      );
      latest.current = list;
      setConversations(list);
      run(conversationId, turn.id, question);
    },
    [run],
  );

  const start = useCallback(
    (question: string) => {
      const conversation: Conversation = { id: newId(), title: question, createdAt: now(), updatedAt: now(), turns: [] };
      const list = [conversation, ...latest.current].slice(0, MAX_CONVERSATIONS);
      latest.current = list;
      setConversations(list);
      askIn(conversation.id, question);
      return conversation.id;
    },
    [askIn],
  );

  const retry = useCallback(
    (conversationId: string, turnId: string) => {
      const turn = latest.current.find((c) => c.id === conversationId)?.turns.find((t) => t.id === turnId);
      if (!turn) return;
      patchTurn(conversationId, turnId, { status: 'pending', error: undefined, askedAt: now() });
      run(conversationId, turnId, turn.question);
    },
    [patchTurn, run],
  );

  const togglePin = useCallback(
    (turn: Turn) => {
      if (!turn.answer) return;
      if (pins.some((p) => p.id === turn.id)) {
        setPins(pins.filter((p) => p.id !== turn.id));
        toast.show('Removed from your board.');
        return;
      }
      setPins([
        ...pins,
        {
          id: turn.id,
          question: turn.question,
          answer: turn.answer,
          meta: turn.meta,
          pinnedAt: now(),
          refreshedAt: turn.meta?.as_of ?? now(),
          status: 'idle',
        },
      ]);
      toast.show('Pinned. Refresh the board for the latest numbers.');
    },
    [pins, toast],
  );

  const unpin = useCallback(
    (pinId: string) => {
      setPins((list) => list.filter((p) => p.id !== pinId));
      toast.show('Removed from your board.');
    },
    [toast],
  );

  const refreshPin = useCallback(
    async (pinId: string) => {
      const pin = pins.find((p) => p.id === pinId);
      if (!pin) return;
      setPins((list) => list.map((p) => (p.id === pinId ? { ...p, status: 'refreshing' } : p)));
      try {
        const { answer, meta } = await ask(pin.question, [], ownKey);
        setPins((list) =>
          list.map((p) =>
            p.id === pinId ? { ...p, answer, meta, refreshedAt: meta.as_of ?? now(), status: 'idle' } : p,
          ),
        );
        if (meta.usage) setFreeUsage(meta.usage);
      } catch (e) {
        setPins((list) => list.map((p) => (p.id === pinId ? { ...p, status: 'failed' } : p)));
        if (e instanceof AskError && e.needsOwnKey) toast.show(e.message);
      }
    },
    [pins, ownKey, setFreeUsage, toast],
  );

  const value = useMemo<ConversationsValue>(
    () => ({
      conversations: [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      get: (id) => conversations.find((c) => c.id === id),
      start,
      askIn,
      retry,
      pins,
      isPinned: (turnId) => pins.some((p) => p.id === turnId),
      togglePin,
      unpin,
      refreshPin,
    }),
    [conversations, start, askIn, retry, pins, togglePin, unpin, refreshPin],
  );

  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

export function useConversations() {
  const value = useContext(ConversationsContext);
  if (!value) throw new Error('useConversations must be used inside <ConversationsProvider>');
  return value;
}

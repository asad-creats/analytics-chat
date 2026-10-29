/**
 * Client for the pipeline-ask Edge Function. The answer shape mirrors
 * supabase/functions/pipeline-ask/answer.ts.
 */

export type AnswerKind = 'answer' | 'clarify' | 'cannot_answer';
export type ChartType = 'bar' | 'column' | 'line';

export interface Answer {
  kind: AnswerKind;
  title: string;
  summary: string;
  headline?: { value: string; label: string };
  chart?: {
    type: ChartType;
    title: string;
    subtitle?: string;
    unit?: string;
    series: { name: string; points: { label: string; value: number }[] }[];
  };
  table?: { title?: string; columns: string[]; rows: string[][] };
  basis: string;
  caveat?: string;
  options?: string[];
  follow_ups: string[];
}

export interface AnswerMeta {
  as_of: string | null;
  mode: 'free' | 'own';
  provider: string;
  model: string;
  usage?: { used: number; limit: number };
}

export interface DataStatus {
  as_of: string;
  timezone: string;
  lead_count: number;
  agents: string[];
  source: string;
  free_tier: boolean;
  free_per_visitor: number;
}

export type ProviderId = 'gemini' | 'anthropic' | 'openai' | 'openrouter';

/** Present only when the visitor uses their own key. */
export interface OwnKey {
  provider: ProviderId;
  apiKey: string;
  model?: string;
}

export class AskError extends Error {
  constructor(
    public code: string,
    message: string,
    public detail: Record<string, unknown> = {},
  ) {
    super(message);
  }

  /** Errors that adding your own key fixes. */
  get needsOwnKey() {
    return ['daily_limit', 'site_limit', 'not_configured'].includes(this.code);
  }
}

const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConnected = Boolean(baseUrl);

async function call<T>(body: unknown): Promise<T> {
  if (!baseUrl) {
    throw new AskError('not_connected', 'Live data isn’t connected yet. Set VITE_SUPABASE_URL to the Supabase project.');
  }
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/functions/v1/pipeline-ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AskError('network', 'Couldn’t reach Pipeline. Check your connection and try again.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    const { code = 'error', message = 'Something went wrong.', ...detail } = data?.error ?? {};
    throw new AskError(code, message, detail);
  }
  return data as T;
}

export interface HistoryTurn {
  question: string;
  summary: string;
}

export function ask(question: string, history: HistoryTurn[], ownKey?: OwnKey) {
  return call<{ answer: Answer; meta: AnswerMeta }>({ question, history, llm: ownKey });
}

export function fetchStatus() {
  return call<DataStatus>({ action: 'status' });
}

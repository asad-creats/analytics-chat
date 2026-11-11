import type { Report, ReportOptions } from '../../supabase/functions/pipeline-ask/report.ts';

export type { Report, ReportOptions, ReportSection } from '../../supabase/functions/pipeline-ask/report.ts';

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
  /** sample: the browser demo's no-key answers. */
  mode: 'free' | 'own' | 'sample';
  provider: string;
  model: string;
  usage?: { used: number; limit: number };
}

export type CrmStatus = 'demo' | 'connected' | 'syncing' | 'error' | 'disconnected';

/** Where the data comes from: which CRM, and whether it's connected. */
export interface CrmInfo {
  name: string;
  status: CrmStatus;
  account: string | null;
  last_error: string | null;
  sync_every_minutes: number;
}

export interface DataStatus {
  as_of: string;
  timezone: string;
  lead_count: number;
  agents: string[];
  source: string;
  crm: CrmInfo;
  counts: { leads: number; activities: number; appointments: number; deals: number; agents: number };
  last_activity_at: string | null;
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
    return ['daily_limit', 'site_limit', 'not_configured', 'needs_key'].includes(this.code);
  }
}

const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * The GitHub Pages build runs everything in the browser (Postgres via PGlite,
 * the visitor's own AI key). Loaded on demand so the server build stays small.
 */
export const browserDemo = import.meta.env.VITE_PIPELINE_MODE === 'browser';
const demo = () => import('./demo/browser');

export const isConnected = browserDemo || Boolean(baseUrl);

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

export async function ask(question: string, history: HistoryTurn[], ownKey?: OwnKey) {
  if (browserDemo) return (await demo()).ask(question, history, ownKey);
  return call<{ answer: Answer; meta: AnswerMeta }>({ question, history, llm: ownKey });
}

export async function generateReport(options: ReportOptions, ownKey?: OwnKey) {
  if (browserDemo) return (await demo()).report(options, ownKey);
  return call<{ report: Report; meta: AnswerMeta }>({ action: 'report', options, llm: ownKey });
}

export async function fetchStatus() {
  if (browserDemo) return (await demo()).status();
  return call<DataStatus>({ action: 'status' });
}

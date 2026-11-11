/**
 * The GitHub Pages demo's backend, running entirely in the visitor's browser:
 * Postgres (PGlite) seeded by the real migrations, the same agent the Edge
 * Function runs, and the visitor's own AI key sent straight to their provider.
 */
import { PGlite } from '@electric-sql/pglite';
import schemaSql from '../../../supabase/migrations/001_pipeline_schema.sql?raw';
import demoDataSql from '../../../supabase/migrations/002_pipeline_demo_data.sql?raw';
import { runAgent, runReport, type Db } from '../../../supabase/functions/pipeline-ask/agent.ts';
import { defaultModels, LlmError } from '../../../supabase/functions/pipeline-ask/providers.ts';
import {
  AskError,
  type Answer,
  type AnswerMeta,
  type DataStatus,
  type HistoryTurn,
  type OwnKey,
  type Report,
  type ReportOptions,
} from '../pipeline';
import { sampleAnswer, sampleReport } from './samples';

/** How often the simulated team logs new leads and calls (pg_cron's job on the server). */
const TICK_MS = 60_000;

let ready: Promise<Db> | null = null;

/** Boots Postgres, runs the migrations and starts the simulator, once per page load. */
function database(): Promise<Db> {
  ready ??= (async () => {
    const pg = await PGlite.create();
    await pg.exec(schemaSql);
    await pg.exec(demoDataSql);
    await pg.exec(`update pipeline.sync_state set crm = 'Demo CRM', sync_every = interval '1 minute'`);
    window.setInterval(() => void pg.query('select pipeline.simulate_tick()'), TICK_MS);

    const one = async <T>(sql: string, params: unknown[] = []) => (await pg.query<{ r: T }>(sql, params)).rows[0].r;
    return {
      overview: () => one<Record<string, unknown>>('select public.pipeline_overview() as r'),
      // The same guarded function the server uses: read-only, CRM tables only.
      runQuery: (sql: string) => one<unknown[]>('select public.pipeline_run_query($1) as r', [sql]),
    };
  })();
  return ready;
}

export async function status(): Promise<DataStatus> {
  const o = await (await database()).overview();
  return {
    as_of: String(o.synced_at),
    timezone: String(o.timezone),
    lead_count: Number(o.lead_count),
    agents: (o.agents as string[]) ?? [],
    source: String(o.data_source),
    crm: o.crm as DataStatus['crm'],
    counts: o.counts as DataStatus['counts'],
    last_activity_at: (o.last_activity_at as string) ?? null,
    free_tier: true,
    free_per_visitor: 0,
  };
}

export async function ask(
  question: string,
  history: HistoryTurn[],
  ownKey?: OwnKey,
): Promise<{ answer: Answer; meta: AnswerMeta }> {
  const db = await database();
  const asOf = String((await db.overview()).synced_at);

  if (!ownKey) {
    const answer = await sampleAnswer(question, db);
    if (!answer) {
      throw new AskError(
        'needs_key',
        'Without an AI key this demo answers its sample questions only. Add your own key in AI settings to ask anything; it goes straight from your browser to the AI provider.',
      );
    }
    return { answer, meta: { as_of: asOf, mode: 'sample', provider: 'none', model: 'none' } };
  }

  try {
    const llm = ownLlm(ownKey);
    const result = await runAgent({ question, history, llm, db });
    return {
      answer: result.answer as Answer,
      meta: { as_of: result.asOf, mode: 'own', provider: llm.provider, model: llm.model },
    };
  } catch (error) {
    throw asAskError(error, ownKey.provider);
  }
}

export async function report(options: ReportOptions, ownKey?: OwnKey): Promise<{ report: Report; meta: AnswerMeta }> {
  const db = await database();
  if (!ownKey) {
    const asOf = String((await db.overview()).synced_at);
    return { report: await sampleReport(options, db), meta: { as_of: asOf, mode: 'sample', provider: 'none', model: 'none' } };
  }
  try {
    const llm = ownLlm(ownKey);
    const result = await runReport({ options, llm, db });
    return { report: result.report, meta: { as_of: result.asOf, mode: 'own', provider: llm.provider, model: llm.model } };
  } catch (error) {
    throw asAskError(error, ownKey.provider);
  }
}

function ownLlm(ownKey: OwnKey) {
  return {
    provider: ownKey.provider,
    apiKey: ownKey.apiKey,
    model: ownKey.model || defaultModels[ownKey.provider],
    browser: true,
  };
}

function asAskError(error: unknown, provider: string): AskError {
  if (error instanceof LlmError) return new AskError(`llm_${error.code}`, error.message);
  const message = (error as Error).message ?? '';
  // A browser blocks a provider that doesn't allow calls from web pages.
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return new AskError('llm_error', `Couldn’t reach ${provider} from your browser. Check the key and your connection.`);
  }
  return new AskError('error', message || 'Something went wrong.');
}

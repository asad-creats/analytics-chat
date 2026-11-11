/**
 * The GitHub Pages demo's backend, running entirely in the visitor's browser:
 * Postgres (PGlite) seeded by the real migrations, the same agent the Edge
 * Function runs, and the visitor's own AI key sent straight to their provider.
 */
import { PGlite } from '@electric-sql/pglite';
import schemaSql from '../../../supabase/migrations/001_pipeline_schema.sql?raw';
import demoDataSql from '../../../supabase/migrations/002_pipeline_demo_data.sql?raw';
import { runAgent, type Db } from '../../../supabase/functions/pipeline-ask/agent.ts';
import { defaultModels, LlmError } from '../../../supabase/functions/pipeline-ask/providers.ts';
import { AskError, type Answer, type AnswerMeta, type DataStatus, type HistoryTurn, type OwnKey } from '../pipeline';
import { sampleAnswer } from './samples';

/** How often the simulated team logs new leads and calls (pg_cron's job on the server). */
const TICK_MS = 60_000;

let ready: Promise<Db> | null = null;

/** Boots Postgres, runs the migrations and starts the simulator, once per page load. */
function database(): Promise<Db> {
  ready ??= (async () => {
    const pg = await PGlite.create();
    await pg.exec(schemaSql);
    await pg.exec(demoDataSql);
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

  const llm = {
    provider: ownKey.provider,
    apiKey: ownKey.apiKey,
    model: ownKey.model || defaultModels[ownKey.provider],
    browser: true,
  };
  try {
    const result = await runAgent({ question, history, llm, db });
    return {
      answer: result.answer as Answer,
      meta: { as_of: result.asOf, mode: 'own', provider: llm.provider, model: llm.model },
    };
  } catch (error) {
    if (error instanceof LlmError) throw new AskError(`llm_${error.code}`, error.message);
    const message = (error as Error).message ?? '';
    // A browser blocks a provider that doesn't allow calls from web pages.
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      throw new AskError('llm_error', `Couldn’t reach ${llm.provider} from your browser. Check the key and your connection.`);
    }
    throw new AskError('error', message || 'Something went wrong.');
  }
}

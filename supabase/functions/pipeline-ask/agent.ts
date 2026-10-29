import { type Answer, parseAnswer } from "./answer.ts";
import { type HistoryTurn, systemPrompt, tools, userMessage } from "./prompt.ts";
import { type LlmConfig, LlmError, type LoopRunner, runToolLoop } from "./providers.ts";

/** Where the data comes from. Production uses the Supabase API; tests use a local Postgres. */
export interface Db {
  overview(): Promise<Record<string, unknown>>;
  /** Runs one read-only query; throws with Postgres' message on error. */
  runQuery(sql: string): Promise<unknown[]>;
}

export interface AgentResult {
  answer: Answer;
  steps: number;
  queries: number;
  asOf: string | null;
}

const MAX_QUERIES = 10;
const MAX_RESULT_CHARS = 24_000;

export async function runAgent(opts: {
  question: string;
  history: HistoryTurn[];
  llm: LlmConfig;
  db: Db;
  loop?: LoopRunner;
  maxSteps?: number;
}): Promise<AgentResult> {
  const { question, history, llm, db, loop = runToolLoop, maxSteps = 8 } = opts;

  const overview = await db.overview();
  let answer: Answer | null = null;
  let queries = 0;
  let successful = 0;

  const { steps } = await loop(
    llm,
    systemPrompt(overview),
    userMessage(question, history),
    tools,
    async (name, args) => {
      if (name === "run_query") {
        if (queries >= MAX_QUERIES) {
          return { content: "Query limit reached for this question. Answer with what you have." };
        }
        queries++;
        const sql = typeof args.sql === "string" ? args.sql : "";
        try {
          const rows = await db.runQuery(sql);
          successful++;
          let text = JSON.stringify(rows);
          if (text.length > MAX_RESULT_CHARS) {
            text = text.slice(0, MAX_RESULT_CHARS) + " …(truncated; aggregate in SQL instead of listing rows)";
          }
          return { content: `${rows.length} row(s)${rows.length === 200 ? " (capped at 200)" : ""}: ${text}` };
        } catch (error) {
          return { content: `Query failed: ${(error as Error).message}. Fix the SQL and try again.` };
        }
      }

      if (name === "give_answer") {
        const parsed = parseAnswer(args);
        if ("problem" in parsed) return { content: `Not delivered: ${parsed.problem} Call give_answer again.` };
        if (parsed.answer.kind === "answer" && successful === 0) {
          return { content: "Not delivered: look the data up with run_query first, then call give_answer." };
        }
        answer = parsed.answer;
        return { content: "Delivered.", done: true };
      }

      return { content: `Unknown tool ${name}. Use run_query or give_answer.` };
    },
    maxSteps,
  );

  if (!answer) throw new LlmError("no_answer", "The model finished without an answer.");
  return { answer, steps, queries, asOf: (overview.synced_at as string) ?? null };
}

import { type Answer, parseAnswer } from "./answer.ts";
import { type HistoryTurn, reportTools, systemPrompt, type ToolDef, tools, userMessage } from "./prompt.ts";
import { type LlmConfig, LlmError, type LoopRunner, runToolLoop, type ToolOutcome } from "./providers.ts";
import { parseReport, type Report, type ReportOptions, reportRequest } from "./report.ts";

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

export interface ReportResult {
  report: Report;
  steps: number;
  queries: number;
  asOf: string | null;
}

const MAX_RESULT_CHARS = 24_000;

/**
 * The tool loop both answers and reports use: run_query with a budget, then
 * one final tool whose input is checked before it's accepted.
 */
async function runWithTools<T>(opts: {
  llm: LlmConfig;
  db: Db;
  loop: LoopRunner;
  system: string;
  user: string;
  tools: ToolDef[];
  finalTool: string;
  /** Checks the final tool's input; `needsData` refuses it until a query has succeeded. */
  accept: (args: Record<string, unknown>) => { value: T; needsData: boolean } | { problem: string };
  maxQueries: number;
  maxSteps: number;
}): Promise<{ value: T; steps: number; queries: number }> {
  let value: T | undefined;
  let queries = 0;
  let successful = 0;

  const handle = async (name: string, args: Record<string, unknown>): Promise<ToolOutcome> => {
    if (name === "run_query") {
      if (queries >= opts.maxQueries) {
        return { content: `Query limit reached. Call ${opts.finalTool} with what you have.` };
      }
      queries++;
      const sql = typeof args.sql === "string" ? args.sql : "";
      try {
        const rows = await opts.db.runQuery(sql);
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

    if (name === opts.finalTool) {
      const checked = opts.accept(args);
      if ("problem" in checked) return { content: `Not delivered: ${checked.problem} Call ${opts.finalTool} again.` };
      if (checked.needsData && successful === 0) {
        return { content: `Not delivered: look the data up with run_query first, then call ${opts.finalTool}.` };
      }
      value = checked.value;
      return { content: "Delivered.", done: true };
    }

    return { content: `Unknown tool ${name}. Use run_query or ${opts.finalTool}.` };
  };

  const { steps } = await opts.loop(opts.llm, opts.system, opts.user, opts.tools, handle, opts.maxSteps);
  if (value === undefined) throw new LlmError("no_answer", "The model finished without an answer.");
  return { value, steps, queries };
}

export async function runAgent(opts: {
  question: string;
  history: HistoryTurn[];
  llm: LlmConfig;
  db: Db;
  loop?: LoopRunner;
  maxSteps?: number;
}): Promise<AgentResult> {
  const overview = await opts.db.overview();
  const { value, steps, queries } = await runWithTools<Answer>({
    llm: opts.llm,
    db: opts.db,
    loop: opts.loop ?? runToolLoop,
    system: systemPrompt(overview),
    user: userMessage(opts.question, opts.history),
    tools,
    finalTool: "give_answer",
    accept: (args) => {
      const parsed = parseAnswer(args);
      return "problem" in parsed ? parsed : { value: parsed.answer, needsData: parsed.answer.kind === "answer" };
    },
    maxQueries: 10,
    maxSteps: opts.maxSteps ?? 8,
  });
  return { answer: value, steps, queries, asOf: (overview.synced_at as string) ?? null };
}

export async function runReport(opts: {
  options: ReportOptions;
  llm: LlmConfig;
  db: Db;
  loop?: LoopRunner;
  maxSteps?: number;
}): Promise<ReportResult> {
  const overview = await opts.db.overview();
  const expected = opts.options.sections.length;
  const { value, steps, queries } = await runWithTools<Report>({
    llm: opts.llm,
    db: opts.db,
    loop: opts.loop ?? runToolLoop,
    system: systemPrompt(overview, "Finish by calling give_report exactly once, with every requested section."),
    user: reportRequest(opts.options),
    tools: reportTools,
    finalTool: "give_report",
    accept: (args) => {
      const parsed = parseReport(args, expected);
      return "problem" in parsed ? parsed : { value: parsed.report, needsData: true };
    },
    // A section takes two or three lookups; leave room for fixing a query or two.
    maxQueries: 6 + expected * 3,
    maxSteps: opts.maxSteps ?? 10 + expected * 2,
  });
  return { report: value, steps, queries, asOf: (overview.synced_at as string) ?? null };
}

// Tests for the pipeline-ask Edge Function against a real Postgres with the
// migrations applied. Run (from the repo root):
//   PIPELINE_TEST_DB=postgres://postgres:local@localhost:5432/pipeline \
//   deno test -A --config supabase/functions/pipeline-ask/deno.json supabase/tests/
// The LLM is scripted here; the real providers are only exercised for their
// error handling (bad keys), since tests shouldn't spend API credit.

import pg from "npm:pg@8.13.1";
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1.0.13";
import { type Db, runAgent } from "../functions/pipeline-ask/agent.ts";
import { type LlmConfig, LlmError, type LoopRunner, runToolLoop } from "../functions/pipeline-ask/providers.ts";

const DB_URL = Deno.env.get("PIPELINE_TEST_DB") ?? "postgres://postgres:local@localhost:5432/pipeline";

async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function rpc(fn: string, args: unknown[]): Promise<unknown> {
  return await withClient(async (c) => {
    const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
    const { rows } = await c.query(`select public.${fn}(${placeholders}) as r`, args);
    return rows[0].r;
  });
}

const localDb: Db = {
  overview: async () => (await rpc("pipeline_overview", [])) as Record<string, unknown>,
  runQuery: async (sql) => (await rpc("pipeline_run_query", [sql])) as unknown[],
};

const fakeLlm: LlmConfig = { provider: "gemini", apiKey: "test", model: "scripted" };

/** A pretend model that makes the given tool calls in order and records the replies. */
function scripted(calls: { name: string; args: Record<string, unknown> }[], replies: string[]): LoopRunner {
  return async (_cfg, system, _user, _tools, handle) => {
    assertMatch(system, /schema "pipeline"/);
    let step = 0;
    for (const call of calls) {
      step++;
      const outcome = await handle(call.name, call.args);
      replies.push(outcome.content);
      if (outcome.done) return { steps: step };
    }
    throw new LlmError("no_answer", "script ended");
  };
}

const goodAnswer = {
  kind: "answer",
  title: "Lead sources",
  summary: "Referrals closed best at **18%**.",
  chart: {
    type: "bar",
    title: "Close rate by source",
    unit: "%",
    series: [{ name: "Close rate", points: [{ label: "Referral", value: 18.2 }, { label: "Zillow", value: "oops" }] }],
  },
  table: { columns: ["Source", "Leads"], rows: [["Referral", 55, "extra"], ["Zillow"]] },
  basis: "Based on all leads",
  follow_ups: ["Break this down by agent", 42],
};

Deno.test("agent: fixes a bad query, insists on data, then delivers a tidy answer", async () => {
  const replies: string[] = [];
  const result = await runAgent({
    question: "Which lead sources closed best?",
    history: [{ question: "earlier", summary: "earlier answer" }],
    llm: fakeLlm,
    db: localDb,
    loop: scripted(
      [
        { name: "give_answer", args: goodAnswer }, // before looking anything up
        { name: "run_query", args: { sql: "select nope from pipeline.leads", purpose: "typo" } },
        { name: "run_query", args: { sql: "delete from pipeline.leads", purpose: "should be refused" } },
        {
          name: "run_query",
          args: {
            sql: "select source, count(*) leads, count(*) filter (where stage = 'Closed') closed from pipeline.leads where not is_duplicate group by 1 order by 3 desc",
            purpose: "close rate",
          },
        },
        { name: "give_answer", args: { ...goodAnswer, kind: "maybe" } },
        { name: "give_answer", args: goodAnswer },
      ],
      replies,
    ),
  });

  assertMatch(replies[0], /look the data up with run_query first/);
  assertMatch(replies[1], /Query failed: column "nope" does not exist/);
  assertMatch(replies[2], /Query failed: Only SELECT queries are allowed/);
  assertMatch(replies[3], /^6 row\(s\): \[/);
  assertMatch(replies[4], /kind must be/);
  assertEquals(replies[5], "Delivered.");

  const a = result.answer;
  assertEquals(a.kind, "answer");
  assertEquals(a.chart?.series[0].points, [{ label: "Referral", value: 18.2 }]); // non-numeric point dropped
  assertEquals(a.table?.rows, [["Referral", "55"], ["Zillow", ""]]); // rows fitted to the columns
  assertEquals(a.follow_ups, ["Break this down by agent"]);
  assertEquals(result.queries, 3);
  assert(result.asOf);
});

Deno.test("agent: clarify and cannot_answer don't need a query", async () => {
  const replies: string[] = [];
  const result = await runAgent({
    question: "How are we doing?",
    history: [],
    llm: fakeLlm,
    db: localDb,
    loop: scripted(
      [
        { name: "give_answer", args: { kind: "clarify", title: "Clarify", summary: "Which number?", basis: "", follow_ups: [], options: ["Only one"] } },
        {
          name: "give_answer",
          args: {
            kind: "clarify",
            title: "Clarify",
            summary: "Which number?",
            basis: "",
            follow_ups: [],
            options: ["How many deals closed this month?", "How many new leads came in this month?"],
          },
        },
      ],
      replies,
    ),
  });
  assertMatch(replies[0], /clarify needs 2-4 options/);
  assertEquals(result.answer.options?.length, 2);
});

Deno.test("agent: the model can't escape read-only access", async () => {
  const attempts = [
    "select set_config('role', 'postgres', false)",
    "select 1) t; delete from pipeline.leads; select (1",
    "with d as (delete from pipeline.leads returning *) select * from d",
    "select * from pipeline.ask_usage",
    "select pg_sleep(10)",
  ];
  const before = await localDb.runQuery("select count(*) n from pipeline.leads");
  for (const sql of attempts) {
    let failed = false;
    try {
      await localDb.runQuery(sql);
    } catch {
      failed = true;
    }
    assert(failed, `should have been refused: ${sql}`);
  }
  assertEquals(await localDb.runQuery("select count(*) n from pipeline.leads"), before);
});

Deno.test("providers: a bad Claude key is reported as an auth error", async () => {
  const err = await runToolLoop(
    { provider: "anthropic", apiKey: "sk-ant-invalid", model: "claude-opus-5-5" },
    "system",
    "hi",
    [],
    () => Promise.resolve({ content: "" }),
    2,
  ).catch((e) => e);
  assert(err instanceof LlmError, String(err));
  assertEquals(err.code, "auth");
});

Deno.test("providers: a bad Gemini key is reported as an auth error", async () => {
  const err = await runToolLoop(
    { provider: "gemini", apiKey: "invalid", model: "gemini-2.5-flash" },
    "system",
    "hi",
    [],
    () => Promise.resolve({ content: "" }),
    2,
  ).catch((e) => e);
  assert(err instanceof LlmError, String(err));
  assertEquals(err.code, "auth");
});

Deno.test("http: free tier quota, validation and own-key errors through the real handler", async () => {
  // A stand-in for the Supabase REST API: /rest/v1/rpc/<fn> -> select public.<fn>(...).
  const argOrder: Record<string, string[]> = {
    pipeline_overview: [],
    pipeline_run_query: ["q"],
    pipeline_consume_quota: ["client", "per_client", "site_total"],
  };
  const rest = Deno.serve({ port: 54401, onListen() {} }, async (req) => {
    const fn = new URL(req.url).pathname.split("/").pop()!;
    const body = await req.json();
    try {
      const result = await rpc(fn, argOrder[fn].map((k) => body[k]));
      return Response.json(result);
    } catch (e) {
      return Response.json({ message: (e as Error).message }, { status: 400 });
    }
  });

  await withClient((c) => c.query("delete from pipeline.ask_usage"));
  const fn = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "--config", "supabase/functions/pipeline-ask/deno.json", "supabase/functions/pipeline-ask/index.ts"],
    env: {
      SUPABASE_URL: "http://localhost:54401",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      GEMINI_API_KEY: "invalid-free-key",
      PIPELINE_FREE_PER_VISITOR: "2",
    },
    stdout: "null",
    stderr: "piped",
  }).spawn();

  const ask = async (body: unknown) => {
    for (let i = 0; i < 50; i++) {
      try {
        const res = await fetch("http://localhost:8000", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
          body: JSON.stringify(body),
        });
        return { status: res.status, body: await res.json() };
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    throw new Error("function never started");
  };

  try {
    assertEquals((await ask({})).body.error.code, "bad_request");

    // Free tier: the (invalid) server key fails at Gemini, but each attempt counts.
    const first = await ask({ question: "How many leads this week?" });
    assertEquals(first.body.error.code, "llm_auth");
    await ask({ question: "again" });
    const third = await ask({ question: "and again" });
    assertEquals(third.status, 429);
    assertEquals(third.body.error.code, "daily_limit");

    // Own key skips the quota and reports the provider's verdict.
    const own = await ask({ question: "Hi", llm: { provider: "anthropic", apiKey: "sk-ant-invalid" } });
    assertEquals(own.status, 401);
    assertEquals(own.body.error.code, "llm_auth");

    const bad = await ask({ question: "Hi", llm: { provider: "nope", apiKey: "x" } });
    assertEquals(bad.body.error.code, "bad_request");
  } finally {
    fn.kill();
    await fn.status;
    await fn.stderr.cancel();
    await rest.shutdown();
  }
});

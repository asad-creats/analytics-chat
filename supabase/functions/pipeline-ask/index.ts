// Supabase Edge Function: pipeline-ask
// Answers a question about the team's CRM data. An LLM looks the data up with
// read-only queries, then returns a structured answer the app draws.
//
// Free tier: the server's Gemini key, capped per visitor and per day.
// Own key: the visitor's provider + key come with the request; the key is used
// for this one call and never stored or logged.
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=<key> PIPELINE_QUOTA_SALT=<random string>
//   supabase functions deploy pipeline-ask
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { runAgent } from "./agent.ts";
import { supabaseDb } from "./db.ts";
import type { HistoryTurn } from "./prompt.ts";
import { defaultModels, type LlmConfig, LlmError, type ProviderId } from "./providers.ts";

const PER_VISITOR = Number(Deno.env.get("PIPELINE_FREE_PER_VISITOR") ?? 10);
const SITE_TOTAL = Number(Deno.env.get("PIPELINE_FREE_SITE_TOTAL") ?? 60);
const FREE_MODEL = Deno.env.get("PIPELINE_FREE_MODEL") ?? defaultModels.gemini;
const PROVIDERS: ProviderId[] = ["gemini", "anthropic", "openai", "openrouter"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function fail(code: string, message: string, status: number, extra: Record<string, unknown> = {}) {
  return json({ error: { code, message, ...extra } }, status);
}

async function visitorHash(req: Request): Promise<string> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const salt = Deno.env.get("PIPELINE_QUOTA_SALT") ?? Deno.env.get("SUPABASE_URL") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

function readHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-4)
    .map((t) => ({ question: String(t?.question ?? "").slice(0, 300), summary: String(t?.summary ?? "").slice(0, 600) }))
    .filter((t) => t.question);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("bad_request", "Use POST.", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", "Send JSON.", 400);
  }

  const db = supabaseDb(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Freshness and agent names for the app's top bar; no LLM involved.
  if (body.action === "status") {
    try {
      const o = await db.overview();
      return json({
        as_of: o.synced_at,
        timezone: o.timezone,
        lead_count: o.lead_count,
        agents: o.agents,
        source: o.data_source,
        free_tier: Boolean(Deno.env.get("GEMINI_API_KEY")),
        free_per_visitor: PER_VISITOR,
      });
    } catch (error) {
      return fail("db_error", `Couldn't reach the data: ${(error as Error).message}`, 502);
    }
  }

  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (!question) return fail("bad_request", "Ask a question.", 400);

  // Own key, or the free tier.
  let llm: LlmConfig;
  let usage: { used: number; limit: number } | undefined;
  const own = body.llm as Record<string, unknown> | undefined;
  if (own && typeof own.apiKey === "string" && own.apiKey.trim()) {
    const provider = own.provider as ProviderId;
    if (!PROVIDERS.includes(provider)) return fail("bad_request", "Unknown AI provider.", 400);
    const model = typeof own.model === "string" && own.model.trim() ? own.model.trim() : defaultModels[provider];
    llm = { provider, apiKey: own.apiKey.trim(), model };
  } else {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return fail("not_configured", "The free tier isn't set up yet. Add your own key in AI settings.", 503);
    try {
      const quota = await db.consumeQuota(await visitorHash(req), PER_VISITOR, SITE_TOTAL);
      if (!quota.allowed) {
        return quota.site_full
          ? fail("site_limit", "The free demo is out of questions for today. Add your own key in AI settings to keep going.", 429)
          : fail("daily_limit", `You've used your ${quota.limit} free questions today. Add your own key in AI settings to keep going.`, 429, {
            used: quota.used,
            limit: quota.limit,
          });
      }
      usage = { used: quota.used, limit: quota.limit };
    } catch (error) {
      return fail("db_error", `Couldn't reach the data: ${(error as Error).message}`, 502);
    }
    llm = { provider: "gemini", apiKey, model: FREE_MODEL };
  }

  try {
    const result = await runAgent({ question, history: readHistory(body.history), llm, db });
    return json({
      answer: result.answer,
      meta: {
        as_of: result.asOf,
        mode: own?.apiKey ? "own" : "free",
        provider: llm.provider,
        model: llm.model,
        steps: result.steps,
        queries: result.queries,
        usage,
      },
    });
  } catch (error) {
    if (error instanceof LlmError) {
      const status = error.code === "auth" ? 401 : error.code === "rate_limit" ? 429 : 502;
      return fail(`llm_${error.code}`, error.message, status);
    }
    console.error("pipeline-ask failed", (error as Error).message);
    return fail("error", "Something went wrong working that out.", 500);
  }
});

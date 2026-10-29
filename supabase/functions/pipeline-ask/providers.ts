// One tool-calling loop per LLM provider. Each speaks its own API's message
// format; all of them hand tool calls to the same handler.

import Anthropic from "@anthropic-ai/sdk";
import type { ToolDef } from "./prompt.ts";

export type ProviderId = "gemini" | "anthropic" | "openai" | "openrouter";

export interface LlmConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

export const defaultModels: Record<ProviderId, string> = {
  gemini: "gemini-2.5-flash",
  anthropic: "claude-opus-5-5",
  openai: "gpt-4.1-mini",
  openrouter: "google/gemini-2.5-flash",
};

/** What the handler says back after running a tool. `done` ends the loop. */
export interface ToolOutcome {
  content: string;
  done?: boolean;
}
export type ToolHandler = (name: string, args: Record<string, unknown>) => Promise<ToolOutcome>;

export type LoopRunner = (
  cfg: LlmConfig,
  system: string,
  user: string,
  tools: ToolDef[],
  handle: ToolHandler,
  maxSteps: number,
) => Promise<{ steps: number }>;

export class LlmError extends Error {
  constructor(
    public code: "auth" | "rate_limit" | "refused" | "no_answer" | "error",
    message: string,
  ) {
    super(message);
  }
}

const NUDGE = "Please finish now by calling give_answer with your answer.";
const TIMEOUT_MS = 60_000;

async function httpError(res: Response, provider: string): Promise<LlmError> {
  const body = await res.json().catch(() => ({}));
  const detail = body?.error?.message ?? body?.message ?? res.statusText;
  if (res.status === 401 || res.status === 403 || /api key not valid|invalid api key|API_KEY_INVALID/i.test(detail)) {
    return new LlmError("auth", `${provider} rejected the API key.`);
  }
  if (res.status === 429) return new LlmError("rate_limit", `${provider} rate limit reached. ${detail}`);
  return new LlmError("error", `${provider} error (${res.status}): ${detail}`);
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

/* ---------------- Claude (Anthropic SDK) ---------------- */

// Models that take the server-side refusal fallback ("default" routing).
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

const anthropicLoop: LoopRunner = async (cfg, system, user, tools, handle, maxSteps) => {
  const client = new Anthropic({ apiKey: cfg.apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: user }];
  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema,
  }));
  const fallback = FALLBACK_MODELS.has(cfg.model);
  // Claude 5-generation models: thinking stays on; effort keeps it quick.
  const effort = /^claude-(fable|opus|sonnet|haiku)-5/.test(cfg.model) ? { effort: "medium" as const } : undefined;
  let nudged = false;

  for (let step = 1; step <= maxSteps; step++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: cfg.model,
        max_tokens: 16000,
        system,
        tools: anthropicTools,
        messages,
        ...(effort ? { output_config: effort } : {}),
        ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
        throw new LlmError("auth", "Anthropic rejected the API key.");
      }
      if (error instanceof Anthropic.RateLimitError) throw new LlmError("rate_limit", "Anthropic rate limit reached.");
      if (error instanceof Anthropic.APIError) throw new LlmError("error", `Anthropic error (${error.status}): ${error.message}`);
      throw new LlmError("error", `Couldn't reach Anthropic: ${(error as Error).message}`);
    }

    if (response.stop_reason === "refusal") {
      throw new LlmError("refused", "The model declined to answer this question.");
    }

    // Send the whole content back unchanged (thinking blocks included).
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") continue;

    const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (calls.length === 0) {
      if (nudged) throw new LlmError("no_answer", "The model stopped without giving an answer.");
      nudged = true;
      messages.push({ role: "user", content: NUDGE });
      continue;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    let done = false;
    for (const call of calls) {
      const outcome = await handle(call.name, parseArgs(call.input));
      results.push({ type: "tool_result", tool_use_id: call.id, content: outcome.content });
      done ||= Boolean(outcome.done);
    }
    if (done) return { steps: step };
    messages.push({ role: "user", content: results });
  }
  throw new LlmError("no_answer", "The model ran out of steps before answering.");
};

/* ---------------- Gemini ---------------- */

const geminiLoop: LoopRunner = async (cfg, system, user, tools, handle, maxSteps) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const contents: Record<string, unknown>[] = [{ role: "user", parts: [{ text: user }] }];
  const geminiTools = [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
  let nudged = false;

  for (let step = 1; step <= maxSteps; step++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: geminiTools,
        generationConfig: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch((e) => {
      throw new LlmError("error", `Couldn't reach Gemini: ${e.message}`);
    });
    if (!res.ok) throw await httpError(res, "Gemini");

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    if (!candidate?.content) {
      const reason = candidate?.finishReason ?? data?.promptFeedback?.blockReason;
      if (reason === "SAFETY" || reason === "PROHIBITED_CONTENT") throw new LlmError("refused", "Gemini declined to answer.");
      throw new LlmError("error", `Gemini returned no content (${reason ?? "unknown"}).`);
    }

    // Echo the model's turn as-is: it can carry thought signatures Gemini needs back.
    contents.push(candidate.content);
    const calls = (candidate.content.parts ?? []).filter((p: Record<string, unknown>) => p.functionCall);
    if (calls.length === 0) {
      if (nudged) throw new LlmError("no_answer", "The model stopped without giving an answer.");
      nudged = true;
      contents.push({ role: "user", parts: [{ text: NUDGE }] });
      continue;
    }

    const responses = [];
    let done = false;
    for (const part of calls) {
      const call = part.functionCall as { name: string; args?: unknown };
      const outcome = await handle(call.name, parseArgs(call.args));
      responses.push({ functionResponse: { name: call.name, response: { content: outcome.content } } });
      done ||= Boolean(outcome.done);
    }
    if (done) return { steps: step };
    contents.push({ role: "user", parts: responses });
  }
  throw new LlmError("no_answer", "The model ran out of steps before answering.");
};

/* ---------------- OpenAI and OpenRouter (chat completions) ---------------- */

function chatCompletionsLoop(baseUrl: string, label: string, extraHeaders: Record<string, string> = {}): LoopRunner {
  return async (cfg, system, user, tools, handle, maxSteps) => {
    const messages: Record<string, unknown>[] = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    const fnTools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    let nudged = false;

    for (let step = 1; step <= maxSteps; step++) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}`, ...extraHeaders },
        body: JSON.stringify({ model: cfg.model, messages, tools: fnTools }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }).catch((e) => {
        throw new LlmError("error", `Couldn't reach ${label}: ${e.message}`);
      });
      if (!res.ok) throw await httpError(res, label);

      const data = await res.json();
      const message = data?.choices?.[0]?.message;
      if (!message) throw new LlmError("error", `${label} returned no message.`);
      if (message.refusal) throw new LlmError("refused", "The model declined to answer this question.");

      messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });
      const calls = (message.tool_calls ?? []) as { id: string; function: { name: string; arguments: string } }[];
      if (calls.length === 0) {
        if (nudged) throw new LlmError("no_answer", "The model stopped without giving an answer.");
        nudged = true;
        messages.push({ role: "user", content: NUDGE });
        continue;
      }

      let done = false;
      for (const call of calls) {
        const outcome = await handle(call.function.name, parseArgs(call.function.arguments));
        messages.push({ role: "tool", tool_call_id: call.id, content: outcome.content });
        done ||= Boolean(outcome.done);
      }
      if (done) return { steps: step };
    }
    throw new LlmError("no_answer", "The model ran out of steps before answering.");
  };
}

export const loops: Record<ProviderId, LoopRunner> = {
  anthropic: anthropicLoop,
  gemini: geminiLoop,
  // Override for any OpenAI-compatible endpoint (and for local testing).
  openai: chatCompletionsLoop(Deno.env.get("PIPELINE_OPENAI_BASE_URL") ?? "https://api.openai.com/v1", "OpenAI"),
  openrouter: chatCompletionsLoop("https://openrouter.ai/api/v1", "OpenRouter", {
    "HTTP-Referer": "https://projects-zeta-pied.vercel.app/pipeline/",
    "X-Title": "Pipeline",
  }),
};

export const runToolLoop: LoopRunner = (cfg, ...rest) => loops[cfg.provider](cfg, ...rest);

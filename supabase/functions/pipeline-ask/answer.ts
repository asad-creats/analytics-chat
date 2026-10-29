// The shape every answer comes back in. The frontend draws it with its own
// components, so the model never writes HTML or picks colours.

export type AnswerKind = "answer" | "clarify" | "cannot_answer";
export type ChartType = "bar" | "column" | "line";

export interface Answer {
  kind: AnswerKind;
  /** Short topic for the page header, e.g. "Lead sources · Q3". */
  title: string;
  /** One to three plain sentences. Key numbers wrapped in **double asterisks**. */
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
  /** What the answer was worked out from, e.g. "Based on 268 leads created Jul 1 – Sep 30". */
  basis: string;
  caveat?: string;
  /** For "clarify": the questions the person might have meant. */
  options?: string[];
  follow_ups: string[];
}

/** JSON schema for the give_answer tool. Kept to the subset every provider accepts. */
export const answerSchema = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["answer", "clarify", "cannot_answer"],
      description:
        "answer: you looked the data up and have the answer. clarify: the question could mean several different numbers. cannot_answer: the CRM data doesn't cover it.",
    },
    title: { type: "string", description: "2-5 word topic for the page header, e.g. 'Lead sources · Q3'." },
    summary: {
      type: "string",
      description:
        "1-3 short sentences a busy team lead can read in five seconds. Wrap the key numbers in **double asterisks**. No SQL, table or column names.",
    },
    headline: {
      type: "object",
      description: "Optional big number shown above the chart, for single-number answers.",
      properties: {
        value: { type: "string", description: "e.g. '19.4%', '11 min', '6', '$612K'." },
        label: { type: "string", description: "What the number is, e.g. 'referral close rate'." },
      },
      required: ["value", "label"],
    },
    chart: {
      type: "object",
      description:
        "Optional. bar: compare categories (sources, agents). column: a few time buckets (days, weeks). line: a trend over months, up to 3 series. Leave out for single numbers or lists of people/deals.",
      properties: {
        type: { type: "string", enum: ["bar", "column", "line"] },
        title: { type: "string" },
        subtitle: { type: "string", description: "The period and population, e.g. 'Leads created Jul 1 – Sep 30'." },
        unit: { type: "string", description: "'%', 'min', '$', or '' for counts." },
        series: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              points: {
                type: "array",
                items: {
                  type: "object",
                  properties: { label: { type: "string" }, value: { type: "number" } },
                  required: ["label", "value"],
                },
              },
            },
            required: ["name", "points"],
          },
        },
      },
      required: ["type", "title", "series"],
    },
    table: {
      type: "object",
      description: "Optional list of records (leads, deals, agents). At most 15 rows; every cell is text.",
      properties: {
        title: { type: "string" },
        columns: { type: "array", items: { type: "string" } },
        rows: { type: "array", items: { type: "array", items: { type: "string" } } },
      },
      required: ["columns", "rows"],
    },
    basis: {
      type: "string",
      description: "Plain-English scope, e.g. 'Based on 268 leads created Jul 1 – Sep 30, 2026, duplicates left out'.",
    },
    caveat: { type: "string", description: "Optional honest limit, e.g. 'The CRM shows when it happened, not why.'" },
    options: {
      type: "array",
      items: { type: "string" },
      description: "For clarify only: 2-4 full questions the person might mean.",
    },
    follow_ups: {
      type: "array",
      items: { type: "string" },
      description: "2-4 short next questions that this data can answer.",
    },
  },
  required: ["kind", "title", "summary", "basis", "follow_ups"],
};

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown, maxItems: number, maxLen = 140) =>
  Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : [];

/**
 * Checks and tidies what the model sent. Returns the answer, or a message
 * telling the model what to fix.
 */
export function parseAnswer(input: unknown): { answer: Answer } | { problem: string } {
  if (!input || typeof input !== "object") return { problem: "give_answer needs an object." };
  const raw = input as Record<string, unknown>;

  const kind = raw.kind as AnswerKind;
  if (!["answer", "clarify", "cannot_answer"].includes(kind)) {
    return { problem: "kind must be answer, clarify or cannot_answer." };
  }
  const summary = str(raw.summary, 700);
  if (!summary) return { problem: "summary is required." };

  const answer: Answer = {
    kind,
    title: str(raw.title, 60) || "Answer",
    summary,
    basis: str(raw.basis, 240),
    follow_ups: strList(raw.follow_ups, 4),
  };

  const caveat = str(raw.caveat, 300);
  if (caveat) answer.caveat = caveat;

  if (kind === "clarify") {
    answer.options = strList(raw.options, 4);
    if (answer.options.length < 2) return { problem: "clarify needs 2-4 options." };
    return { answer };
  }

  const headline = raw.headline as Record<string, unknown> | undefined;
  if (headline && str(headline.value)) {
    answer.headline = { value: str(headline.value, 24), label: str(headline.label, 80) };
  }

  const chart = raw.chart as Record<string, unknown> | undefined;
  if (chart && Array.isArray(chart.series) && chart.series.length > 0) {
    const type = chart.type as ChartType;
    if (!["bar", "column", "line"].includes(type)) return { problem: "chart.type must be bar, column or line." };
    const series = (chart.series as Record<string, unknown>[]).slice(0, type === "line" ? 3 : 1).map((s) => ({
      name: str(s?.name, 40) || "Value",
      points: (Array.isArray(s?.points) ? s.points : [])
        .map((p: Record<string, unknown>) => ({ label: str(p?.label, 40), value: Number(p?.value) }))
        .filter((p: { label: string; value: number }) => p.label && Number.isFinite(p.value))
        .slice(0, 24),
    }));
    if (series.every((s) => s.points.length === 0)) {
      return { problem: "chart has no valid points; each point needs a label and a numeric value." };
    }
    answer.chart = {
      type,
      title: str(chart.title, 80) || answer.title,
      subtitle: str(chart.subtitle, 140) || undefined,
      unit: str(chart.unit, 8),
      series,
    };
  }

  const table = raw.table as Record<string, unknown> | undefined;
  if (table && Array.isArray(table.columns) && Array.isArray(table.rows)) {
    const columns = strList(table.columns, 8, 40);
    if (columns.length > 0) {
      answer.table = {
        title: str(table.title, 80) || undefined,
        columns,
        rows: (table.rows as unknown[]).slice(0, 15).map((row) => {
          const cells = Array.isArray(row) ? row.map((c) => (c == null ? "" : String(c).slice(0, 80))) : [];
          return columns.map((_, i) => cells[i] ?? "");
        }),
      };
    }
  }

  return { answer };
}

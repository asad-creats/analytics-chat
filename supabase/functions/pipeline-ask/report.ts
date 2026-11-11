// Reports: several answers on one page, with the findings that matter most
// pulled to the top. The model works through the data with the same
// read-only queries as a single answer, then calls give_report.

import { type Answer, answerSchema, parseAnswer } from "./answer.ts";

export const periods = {
  today: "today so far",
  yesterday: "yesterday",
  this_week: "this week so far (from Monday)",
  last_7_days: "the last 7 days",
  this_month: "this month so far",
  last_month: "last calendar month",
} as const;
export type Period = keyof typeof periods;

export const sections = {
  lead_flow: {
    label: "Lead flow",
    brief: "New leads in the period by source (and by day if the period is a week or more). Compare with the previous period of the same length.",
  },
  speed_to_lead: {
    label: "Speed to lead",
    brief: "Median minutes to first outbound call, text or email for leads created in the period, overall and by agent. Flag the slowest agents and any evening vs daytime gap.",
  },
  waiting_leads: {
    label: "Leads waiting for a call",
    brief: "Leads with no outbound contact yet (created in the period or still open). List them longest wait first with agent and source.",
  },
  agent_activity: {
    label: "Agent activity",
    brief: "Per agent in the period: outbound calls, connected calls, texts and emails. Who is most and least active; a table is best.",
  },
  appointments: {
    label: "Appointments",
    brief: "Appointments set and held in the period, no-shows, by agent; plus what's scheduled for the next 3 days.",
  },
  pipeline: {
    label: "Pipeline movement",
    brief: "Leads by current stage, and how many moved into Appointment set, Showing, Offer, Under contract or Closed during the period.",
  },
  deals_closing: {
    label: "Deals closing",
    brief: "Open deals closing in the next 14 days with volume; call out any not yet clear to close.",
  },
  contingencies: {
    label: "Contingency deadlines",
    brief: "Inspection, appraisal, financing and title deadlines due in the next 7 days, plus any overdue and not done.",
  },
  notes_themes: {
    label: "What leads are saying",
    brief: "Read notes and inbound texts from the period (search and list them) and pull out recurring themes, objections and buyers who sound ready. Quote short snippets with lead names.",
  },
} as const;
export type SectionId = keyof typeof sections;

export interface ReportOptions {
  period: Period;
  sections: SectionId[];
  /** One agent's leads only; null for the whole team. */
  agent?: string | null;
  /** Something specific the reader wants pulled out. */
  focus?: string;
  /** "daily" titles it as the daily report. */
  preset?: "daily" | "custom";
}

export const dailyPreset: ReportOptions = {
  preset: "daily",
  period: "yesterday",
  sections: ["lead_flow", "speed_to_lead", "waiting_leads", "appointments", "deals_closing", "contingencies"],
};

export type ReportSection = Omit<Answer, "kind" | "options" | "follow_ups"> & { heading: string };

export interface Report {
  title: string;
  period_label: string;
  /** The 3-5 most specific, important findings, key numbers in **bold**. */
  highlights: string[];
  sections: ReportSection[];
  basis: string;
}

const sectionProperties = answerSchema.properties as Record<string, unknown>;

/** JSON schema for give_report, built from the single-answer pieces. */
export const reportSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "e.g. 'Daily report · Tue Nov 10' or 'Agent activity · last 7 days'." },
    period_label: { type: "string", description: "The exact dates covered, e.g. 'Mon Nov 9, 12:00 AM – 11:59 PM'." },
    highlights: {
      type: "array",
      items: { type: "string" },
      description:
        "3-5 findings a team lead should act on, most important first. Specific: names, numbers, comparisons. Key numbers in **double asterisks**.",
    },
    sections: {
      type: "array",
      description: "One per requested section, in the order requested.",
      items: {
        type: "object",
        properties: {
          heading: { type: "string", description: "The section's name, e.g. 'Speed to lead'." },
          title: sectionProperties.title,
          summary: sectionProperties.summary,
          headline: sectionProperties.headline,
          chart: sectionProperties.chart,
          table: sectionProperties.table,
          basis: sectionProperties.basis,
          caveat: sectionProperties.caveat,
        },
        required: ["heading", "summary", "basis"],
      },
    },
    basis: { type: "string", description: "One line on what the whole report covers." },
  },
  required: ["title", "period_label", "highlights", "sections", "basis"],
};

export function parseReport(input: unknown, expected: number): { report: Report } | { problem: string } {
  if (!input || typeof input !== "object") return { problem: "give_report needs an object." };
  const raw = input as Record<string, unknown>;
  const highlights = Array.isArray(raw.highlights)
    ? raw.highlights.map((h) => String(h ?? "").trim().slice(0, 400)).filter(Boolean).slice(0, 6)
    : [];
  if (highlights.length < 2) return { problem: "highlights needs 3-5 specific findings." };
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) return { problem: "sections is required." };

  const parsed: ReportSection[] = [];
  for (const [i, s] of (raw.sections as Record<string, unknown>[]).entries()) {
    const result = parseAnswer({ ...s, kind: "answer", title: s?.title ?? s?.heading, follow_ups: [] });
    if ("problem" in result) return { problem: `Section ${i + 1}: ${result.problem}` };
    const { kind: _kind, options: _options, follow_ups: _followUps, ...rest } = result.answer;
    parsed.push({ heading: String(s.heading ?? rest.title).slice(0, 60), ...rest });
  }
  if (parsed.length < expected) {
    return { problem: `Include all ${expected} requested sections (got ${parsed.length}); say plainly if one has nothing to report.` };
  }

  return {
    report: {
      title: String(raw.title ?? "Report").slice(0, 80),
      period_label: String(raw.period_label ?? "").slice(0, 120),
      highlights,
      sections: parsed,
      basis: String(raw.basis ?? "").slice(0, 300),
    },
  };
}

/** The request the model works from. */
export function reportRequest(options: ReportOptions): string {
  const chosen = options.sections.filter((id) => id in sections);
  const lines = [
    `Write a ${options.preset === "daily" ? "daily report" : "report"} for ${periods[options.period]}.`,
    options.agent ? `Only ${options.agent}'s leads, activity and deals.` : "The whole team.",
    "",
    "Sections, in this order:",
    ...chosen.map((id, i) => `${i + 1}. ${sections[id].label}: ${sections[id].brief}`),
  ];
  if (options.focus?.trim()) {
    lines.push(
      "",
      `The reader especially wants this pulled out: "${options.focus.trim().slice(0, 300)}".`,
      "Look for it specifically (search notes and texts if it's about what people said) and lead the highlights with what you find. If the data has nothing on it, say so in a highlight.",
    );
  }
  lines.push(
    "",
    "Work out exact dates for the period in the team's timezone and state them in period_label.",
    "Look everything up with run_query; every number must come from the data. Prefer a few aggregate queries per section over listing rows.",
    "Highlights are the point of the report: specific, surprising or actionable findings with names and numbers, not a restatement of each section.",
    "Then call give_report once with all sections.",
  );
  return lines.join("\n");
}

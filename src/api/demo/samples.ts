/**
 * Answers for the demo's sample questions when the visitor hasn't added an AI
 * key. The numbers come from real queries on the in-browser data (so they move
 * as the simulator adds activity); only the wording is a template, and each
 * answer says so.
 */
import type { Db } from '../../../supabase/functions/pipeline-ask/agent.ts';
import {
  type Report,
  type ReportOptions,
  type ReportSection,
  type SectionId,
  sections,
} from '../../../supabase/functions/pipeline-ask/report.ts';
import type { Answer } from '../pipeline';

const TZ = 'America/New_York';
const NOTE = 'Sample answer, worked out from the demo data without AI.';

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => String(v ?? '');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const MAX_ROWS = 12;
/** First rows only, with a title saying how many there are in all. */
function capped(rows: Row[], noun: string) {
  return { rows: rows.slice(0, MAX_ROWS), title: rows.length > MAX_ROWS ? `First ${MAX_ROWS} of ${rows.length} ${noun}` : undefined };
}

function hoursLabel(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h`;
}

const samples: Record<string, (db: Db) => Promise<Answer>> = {
  'which lead sources closed best last quarter': async (db) => {
    const rows = (await db.runQuery(`
      select source, count(*) as leads, count(*) filter (where stage = 'Closed') as closed,
             round(100.0 * count(*) filter (where stage = 'Closed') / count(*), 1) as rate
      from leads
      where not is_duplicate
        and created_at >= date_trunc('quarter', now()) - interval '3 months'
        and created_at < date_trunc('quarter', now())
      group by source order by rate desc, leads desc`)) as Row[];
    const top = rows[0];
    const second = rows[1];
    const total = rows.reduce((s, r) => s + num(r.leads), 0);
    return {
      kind: 'answer',
      title: 'Lead sources · last quarter',
      summary: `${str(top.source)} closed best: **${num(top.rate)}%** of its leads became closed deals (${num(top.closed)} of ${num(top.leads)})${second ? `, ahead of ${str(second.source)} at **${num(second.rate)}%**` : ''}.`,
      chart: {
        type: 'bar',
        title: 'Close rate by lead source',
        subtitle: 'Leads created last quarter · share now Closed',
        unit: '%',
        series: [{ name: 'Close rate', points: rows.map((r) => ({ label: str(r.source), value: num(r.rate) })) }],
      },
      basis: `Based on ${total} leads created last quarter, duplicates left out. ${NOTE}`,
      follow_ups: ['How many new leads came in this week?', "Who hasn't called their new leads this week?"],
    };
  },

  'how many new leads came in this week': async (db) => {
    const rows = (await db.runQuery(`
      select to_char(created_at at time zone '${TZ}', 'Dy') as day,
             extract(isodow from created_at at time zone '${TZ}') as n, count(*) as leads
      from leads
      where not is_duplicate and created_at at time zone '${TZ}' >= date_trunc('week', now() at time zone '${TZ}')
      group by 1, 2 order by 2`)) as Row[];
    const [prev] = (await db.runQuery(`
      select count(*) as leads from leads
      where not is_duplicate
        and created_at at time zone '${TZ}' >= date_trunc('week', now() at time zone '${TZ}') - interval '7 days'
        and created_at < now() - interval '7 days'`)) as Row[];
    const total = rows.reduce((s, r) => s + num(r.leads), 0);
    const last = num(prev?.leads);
    return {
      kind: 'answer',
      title: 'New leads · this week',
      headline: { value: String(total), label: 'new leads so far this week' },
      summary: `**${plural(total, 'new lead')}** came in since Monday, against **${last}** by this point last week.`,
      chart: {
        type: 'column',
        title: 'New leads by day',
        subtitle: 'This week so far, team time zone',
        unit: '',
        series: [{ name: 'New leads', points: rows.map((r) => ({ label: str(r.day), value: num(r.leads) })) }],
      },
      basis: `Based on leads created since Monday 12:00 AM (${TZ.replace('_', ' ')}). ${NOTE}`,
      follow_ups: ["Who hasn't called their new leads this week?", 'Which lead sources closed best last quarter?'],
    };
  },

  "who hasn't called their new leads this week": async (db) => {
    const rows = (await db.runQuery(`
      select l.name, a.name as agent, l.source,
             to_char(l.created_at at time zone '${TZ}', 'Dy FMHH12:MI AM') as came_in,
             extract(epoch from now() - l.created_at) / 3600 as hours
      from leads l join agents a on a.id = l.agent_id
      where not l.is_duplicate
        and l.created_at at time zone '${TZ}' >= date_trunc('week', now() at time zone '${TZ}')
        and not exists (select 1 from activities x where x.lead_id = l.id and x.direction = 'outbound')
      order by l.created_at`)) as Row[];
    if (rows.length === 0) {
      return {
        kind: 'answer',
        title: 'Uncalled leads · this week',
        headline: { value: '0', label: 'new leads waiting for a call' },
        summary: 'Every lead that came in this week has had **at least one call, text or email**.',
        basis: `Based on leads created since Monday with no outbound activity. ${NOTE}`,
        follow_ups: ['How many new leads came in this week?'],
      };
    }
    const byAgent = new Map<string, number>();
    rows.forEach((r) => byAgent.set(str(r.agent), (byAgent.get(str(r.agent)) ?? 0) + 1));
    const [topAgent, topCount] = [...byAgent.entries()].sort((a, b) => b[1] - a[1])[0];
    const longest = rows[0];
    return {
      kind: 'answer',
      title: 'Uncalled leads · this week',
      headline: { value: String(rows.length), label: 'new leads with no call yet' },
      summary: `**${plural(rows.length, 'new lead')}** from this week ${rows.length === 1 ? 'has' : 'have'} no outbound contact yet. ${topAgent} has **${topCount}** of them; the longest wait is ${str(longest.name)} at **${hoursLabel(num(longest.hours))}**.`,
      table: {
        title: capped(rows, 'leads').title,
        columns: ['Lead', 'Agent', 'Source', 'Came in', 'Waiting'],
        rows: capped(rows, 'leads').rows.map((r) => [str(r.name), str(r.agent), str(r.source), str(r.came_in), hoursLabel(num(r.hours))]),
      },
      basis: `Based on leads created since Monday with no outbound call, text or email. ${NOTE}`,
      follow_ups: ['Why did evening response time slip last month?', 'How many new leads came in this week?'],
    };
  },

  'why did evening response time slip last month': async (db) => {
    const rows = (await db.runQuery(`
      with first_touch as (
        select l.created_at,
               extract(hour from l.created_at at time zone '${TZ}') as h,
               extract(epoch from min(a.occurred_at) - l.created_at) / 60 as minutes
        from leads l join activities a on a.lead_id = l.id and a.direction = 'outbound'
        where not l.is_duplicate
        group by l.id
      )
      select to_char(date_trunc('month', created_at), 'Mon') as month,
             round(percentile_cont(0.5) within group (order by minutes) filter (where h >= 18 or h < 8)) as evening,
             round(percentile_cont(0.5) within group (order by minutes) filter (where h between 8 and 17)) as daytime
      from first_touch
      group by date_trunc('month', created_at) order by date_trunc('month', created_at)`)) as Row[];
    const lastMonth = rows[rows.length - 2] ?? rows[0];
    const before = rows[rows.length - 3] ?? lastMonth;
    return {
      kind: 'answer',
      title: 'Response time by month',
      headline: { value: `${num(lastMonth.evening)} min`, label: `median evening first response, ${str(lastMonth.month)}` },
      summary: `Evening leads waited a median **${num(lastMonth.evening)} min** for a first reply in ${str(lastMonth.month)}, up from **${num(before.evening)} min** in ${str(before.month)}. Daytime held at about **${num(lastMonth.daytime)} min**, so the slip came from leads arriving after 6 PM.`,
      caveat: 'The CRM shows when the slip happened, not why. A change in evening coverage would explain it, but the data can’t confirm that.',
      chart: {
        type: 'line',
        title: 'Median minutes to first response',
        subtitle: 'All new leads, by month created · this month is month to date',
        unit: 'min',
        series: [
          { name: 'Daytime', points: rows.map((r) => ({ label: str(r.month), value: num(r.daytime) })) },
          { name: 'After 6 PM', points: rows.map((r) => ({ label: str(r.month), value: num(r.evening) })) },
        ],
      },
      basis: `Based on each lead's first outbound call, text or email; evening means created 6 PM – 8 AM. ${NOTE}`,
      follow_ups: ["Who hasn't called their new leads this week?", 'Which deals close in the next 14 days?'],
    };
  },

  'which deals close in the next 14 days': async (db) => {
    const rows = (await db.runQuery(`
      select d.address, a.name as agent, d.price, d.stage, to_char(d.close_date, 'Mon FMDD') as closes,
             (select string_agg(dd.kind || ' ' || to_char(dd.due_date, 'Mon FMDD'), ', ' order by dd.due_date)
                from deal_deadlines dd
               where dd.deal_id = d.id and not dd.done and dd.due_date <= current_date + 7) as due_soon
      from deals d join agents a on a.id = d.agent_id
      where d.stage in ('Under contract', 'Clear to close')
        and d.close_date between current_date and current_date + 14
      order by d.close_date`)) as Row[];
    const needAction = rows.filter((r) => r.due_soon).length;
    const volume = rows.reduce((s, r) => s + num(r.price), 0);
    const money = volume >= 1e6 ? `$${(volume / 1e6).toFixed(1)}M` : `$${Math.round(volume / 1e3)}K`;
    return {
      kind: 'answer',
      title: 'Deals closing · next 14 days',
      headline: { value: String(rows.length), label: `deals closing, ${money} in volume` },
      summary: `**${plural(rows.length, 'deal')}** ${rows.length === 1 ? 'is' : 'are'} set to close in the next two weeks${needAction ? `; **${needAction}** still ${needAction === 1 ? 'has' : 'have'} a contingency due within 7 days` : ', with no contingencies due this week'}.`,
      table: {
        title: capped(rows, 'deals').title,
        columns: ['Closes', 'Address', 'Agent', 'Stage', 'Due this week'],
        rows: capped(rows, 'deals').rows.map((r) => [str(r.closes), str(r.address), str(r.agent), str(r.stage), str(r.due_soon) || '–']),
      },
      basis: `Based on open deals with an expected close date in the next 14 days. ${NOTE}`,
      follow_ups: ['Which contingencies are due this week?', 'Which lead sources closed best last quarter?'],
    };
  },

  'which contingencies are due this week': async (db) => {
    const rows = (await db.runQuery(`
      select dd.kind, to_char(dd.due_date, 'Dy Mon FMDD') as due, dd.due_date - current_date as days,
             d.address, a.name as agent
      from deal_deadlines dd
      join deals d on d.id = dd.deal_id join agents a on a.id = d.agent_id
      where not dd.done and dd.due_date between current_date and current_date + 7
      order by dd.due_date`)) as Row[];
    const today = rows.filter((r) => num(r.days) <= 1).length;
    return {
      kind: 'answer',
      title: 'Contingencies · next 7 days',
      headline: { value: String(rows.length), label: 'contingencies due in the next 7 days' },
      summary: rows.length
        ? `**${plural(rows.length, 'contingency', 'contingencies')}** come due in the next week${today ? `, **${today}** of them today or tomorrow` : ''}. The first is the ${str(rows[0].kind).toLowerCase()} on ${str(rows[0].address)}.`
        : 'No contingencies come due in the next 7 days.',
      table: rows.length
        ? {
            title: capped(rows, 'contingencies').title,
            columns: ['Due', 'Contingency', 'Address', 'Agent'],
            rows: capped(rows, 'contingencies').rows.map((r) => [str(r.due), str(r.kind), str(r.address), str(r.agent)]),
          }
        : undefined,
      basis: `Based on open deals' inspection, appraisal, financing and title deadlines. ${NOTE}`,
      follow_ups: ['Which deals close in the next 14 days?'],
    };
  },

  'how are we doing this month': async () => ({
    kind: 'clarify',
    title: 'Which number?',
    summary: '“Doing” could mean a few things. Which number should I use?',
    options: [
      'How many new leads came in this week?',
      'Which deals close in the next 14 days?',
      'Why did evening response time slip last month?',
    ],
    basis: NOTE,
    follow_ups: [],
  }),

  'which agent is most likely to quit': async () => ({
    kind: 'cannot_answer',
    title: 'Outside the data',
    summary:
      'I can’t answer that from your CRM. It records leads, calls, appointments and deals, not how agents feel about their work.',
    basis: NOTE,
    follow_ups: ["Who hasn't called their new leads this week?"],
  }),
};

const normalise = (q: string) =>
  q
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[?.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** The questions that work without a key, as the home page offers them. */
export const sampleQuestions = Object.keys(samples);

export async function sampleAnswer(question: string, db: Db): Promise<Answer | null> {
  const run = samples[normalise(question)];
  return run ? run(db) : null;
}

/* ---------- Reports ---------- */

/** Report sections that only exist in reports, from fixed queries. */
const reportOnly: Partial<Record<SectionId, (db: Db) => Promise<Answer>>> = {
  agent_activity: async (db) => {
    const rows = (await db.runQuery(`
      select a.name,
             count(*) filter (where x.type = 'call') as calls,
             count(*) filter (where x.type = 'call' and x.outcome = 'connected') as connected,
             count(*) filter (where x.type = 'text') as texts,
             count(*) filter (where x.type = 'email') as emails
      from agents a
      left join activities x on x.agent_id = a.id and x.direction = 'outbound'
        and x.occurred_at >= now() - interval '7 days'
      where a.active
      group by a.name order by calls desc`)) as Row[];
    const top = rows[0];
    const low = rows[rows.length - 1];
    return {
      kind: 'answer',
      title: 'Agent activity · last 7 days',
      summary: `${str(top.name)} made the most calls (**${num(top.calls)}**, ${num(top.connected)} connected); ${str(low.name)} made the fewest (**${num(low.calls)}**).`,
      table: {
        columns: ['Agent', 'Calls', 'Connected', 'Texts', 'Emails'],
        rows: rows.map((r) => [str(r.name), String(num(r.calls)), String(num(r.connected)), String(num(r.texts)), String(num(r.emails))]),
      },
      basis: `Outbound activity in the last 7 days. ${NOTE}`,
      follow_ups: [],
    };
  },

  appointments: async (db) => {
    const [held] = (await db.runQuery(`
      select count(*) filter (where status = 'completed') as held, count(*) filter (where status = 'no-show') as no_shows
      from appointments where scheduled_for between now() - interval '7 days' and now()`)) as Row[];
    const rows = (await db.runQuery(`
      select a.name as agent, count(*) as upcoming
      from appointments ap join agents a on a.id = ap.agent_id
      where ap.status = 'scheduled' and ap.scheduled_for between now() and now() + interval '3 days'
      group by a.name order by upcoming desc`)) as Row[];
    const upcoming = rows.reduce((s, r) => s + num(r.upcoming), 0);
    return {
      kind: 'answer',
      title: 'Appointments',
      headline: { value: String(upcoming), label: 'appointments in the next 3 days' },
      summary: `**${num(held?.held)}** appointments were held in the last 7 days, with **${num(held?.no_shows)}** no-shows. **${upcoming}** are booked for the next 3 days.`,
      chart: rows.length
        ? {
            type: 'bar',
            title: 'Booked for the next 3 days, by agent',
            unit: '',
            series: [{ name: 'Appointments', points: rows.map((r) => ({ label: str(r.agent), value: num(r.upcoming) })) }],
          }
        : undefined,
      basis: `Held and no-shows: last 7 days. Booked: next 3 days. ${NOTE}`,
      follow_ups: [],
    };
  },

  pipeline: async (db) => {
    const rows = (await db.runQuery(`
      select stage, count(*) as leads,
             count(*) filter (where updated_at >= now() - interval '7 days') as moved
      from leads where not is_duplicate and stage not in ('Lost')
      group by stage
      order by array_position(array['New','Attempted','Contacted','Appointment set','Showing','Offer','Under contract','Closed'], stage)`)) as Row[];
    const moved = rows.filter((r) => ['Appointment set', 'Showing', 'Offer', 'Under contract', 'Closed'].includes(str(r.stage)));
    const movedCount = moved.reduce((s, r) => s + num(r.moved), 0);
    return {
      kind: 'answer',
      title: 'Pipeline by stage',
      summary: `**${rows.reduce((s, r) => s + num(r.leads), 0)}** open and closed leads in the pipeline; **${movedCount}** moved into appointment, showing, offer, contract or closed in the last 7 days.`,
      chart: {
        type: 'bar',
        title: 'Leads by current stage',
        unit: '',
        series: [{ name: 'Leads', points: rows.map((r) => ({ label: str(r.stage), value: num(r.leads) })) }],
      },
      basis: `Current stage of every lead except lost ones; movement over the last 7 days. ${NOTE}`,
      follow_ups: [],
    };
  },
};

const sectionSample: Record<SectionId, string | null> = {
  lead_flow: 'how many new leads came in this week',
  speed_to_lead: 'why did evening response time slip last month',
  waiting_leads: "who hasn't called their new leads this week",
  agent_activity: null,
  appointments: null,
  pipeline: null,
  deals_closing: 'which deals close in the next 14 days',
  contingencies: 'which contingencies are due this week',
  notes_themes: null,
};

const firstSentence = (text: string) => (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim();

/**
 * A report without AI: each section from its fixed query and period. It says
 * so, since the period, agent and focus the reader chose can't be honoured.
 */
export async function sampleReport(options: ReportOptions, db: Db): Promise<Report> {
  const built: ReportSection[] = [];
  for (const id of options.sections) {
    const heading = sections[id].label;
    const sampleKey = sectionSample[id];
    const run = sampleKey ? samples[sampleKey] : reportOnly[id];
    if (!run) {
      built.push({
        heading,
        title: heading,
        summary: 'Reading what leads wrote needs an AI key: add one in AI settings and generate this report again.',
        basis: NOTE,
      });
      continue;
    }
    const { kind: _kind, options: _options, follow_ups: _followUps, ...answer } = await run(db);
    built.push({ heading, ...answer });
  }
  return {
    title: options.preset === 'daily' ? 'Daily report (sample)' : 'Report (sample)',
    period_label: 'Sample report: each section uses its own fixed period',
    highlights: built
      .filter((s) => s.chart || s.table || s.headline)
      .slice(0, 5)
      .map((s) => firstSentence(s.summary)),
    sections: built,
    basis: `Without an AI key, sections come from fixed queries and the chosen period${options.agent ? ', agent' : ''}${options.focus ? ' and focus' : ''} are not applied. Add a key in AI settings for the full report.`,
  };
}

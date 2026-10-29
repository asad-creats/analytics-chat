/**
 * Demo dataset. Every number here is fake and matches the Pipeline design
 * mocks; the app labels itself "Demo · fake data" wherever these show.
 */

export const dataset = {
  asOf: '7:00 AM',
  leadCount: 412,
  agentCount: 9,
};

export const currentUser = {
  name: 'Morgan Lee',
  initials: 'ML',
  role: 'Team lead · Demo team',
};

export const teamScopes = ['Whole team', 'Jordan Reyes', 'Priya Shah', 'Marcus Bell'];

export interface Suggestion {
  question: string;
  to: string;
}

export const suggestionGroups: { topic: string; items: Suggestion[] }[] = [
  {
    topic: 'Leads',
    items: [
      { question: 'Which lead sources closed best last quarter?', to: '/answer/lead-sources' },
      { question: 'How many new leads came in this week?', to: '/board#new-leads' },
    ],
  },
  {
    topic: 'Agents',
    items: [
      { question: "Who hasn't called their new leads this week?", to: '/thread/monday#uncalled' },
      { question: 'Why did response time slip in September?', to: '/thread/monday#response-slip' },
    ],
  },
  {
    topic: 'Deals',
    items: [
      { question: 'Which deals close in the next 14 days?', to: '/board#deals-closing' },
      { question: 'Which contingencies are due this week?', to: '/board#deals-closing' },
    ],
  },
];

export const recentConversations = [
  { title: 'Monday team check-in', to: '/thread/monday' },
  { title: 'Which lead sources closed best last quarter?', to: '/answer/lead-sources' },
];

/* ---------- Lead sources, Q3 ---------- */

export interface SourceRow {
  source: string;
  short: string;
  closed: number;
  leads: number;
}

export const leadSources: SourceRow[] = [
  { source: 'Referral', short: 'Referral', closed: 6, leads: 31 },
  { source: 'Zillow', short: 'Zillow', closed: 6, leads: 92 },
  { source: 'Website (IDX)', short: 'Website', closed: 3, leads: 64 },
  { source: 'Open house', short: 'Open house', closed: 1, leads: 27 },
  { source: 'Facebook ads', short: 'Facebook ads', closed: 1, leads: 54 },
];

export const closeRate = (row: SourceRow) => Math.round((1000 * row.closed) / row.leads) / 10;

export const leadSourcesQuery = `SELECT source,
       COUNT(*)                                   AS leads,
       COUNT(*) FILTER (WHERE stage = 'Closed')   AS closed,
       ROUND(100.0 * closed / leads, 1)           AS close_rate_pct
FROM   leads
WHERE  created_at BETWEEN '2026-07-01' AND '2026-09-30'
  AND  is_duplicate = false
GROUP  BY source
ORDER  BY close_rate_pct DESC;`;

/* ---------- Uncalled leads, this week ---------- */

export interface UncalledLead {
  name: string;
  agent: string;
  phone: string;
  email: string;
  cameIn: string;
  waiting: string;
}

export const uncalledLeads: UncalledLead[] = [
  { name: 'Dana Whitfield', agent: 'Jordan Reyes', phone: '(919) 555-0142', email: 'dana.w@example.com', cameIn: 'Tue 7:28 AM', waiting: '2d 1h' },
  { name: 'Luis Ortega', agent: 'Jordan Reyes', phone: '(919) 555-0117', email: 'l.ortega@example.com', cameIn: 'Tue 4:12 PM', waiting: '1d 16h' },
  { name: 'Ava Brooks', agent: 'Priya Shah', phone: '(919) 555-0108', email: 'ava.brooks@example.com', cameIn: 'Wed 9:05 AM', waiting: '23h' },
  { name: 'Kim Nguyen', agent: 'Jordan Reyes', phone: '(919) 555-0163', email: 'kim.n@example.com', cameIn: 'Wed 6:40 PM', waiting: '14h' },
  { name: 'Sam Patel', agent: 'Priya Shah', phone: '(919) 555-0155', email: 'sam.patel@example.com', cameIn: 'Wed 8:15 PM', waiting: '12h' },
  { name: 'Erin Cole', agent: 'Marcus Bell', phone: '(919) 555-0129', email: 'erin.cole@example.com', cameIn: 'Thu 6:52 AM', waiting: '1h 29m' },
];

export const uncalledByAgent = [
  { agent: 'Jordan Reyes', count: 3 },
  { agent: 'Priya Shah', count: 2 },
  { agent: 'Marcus Bell', count: 1 },
];

export const uncalledQuery = `SELECT l.name, l.agent, l.phone, l.email, l.created_at,
       NOW() - l.created_at AS waiting
FROM   leads l
WHERE  l.created_at >= DATE_TRUNC('week', NOW())
  AND  NOT EXISTS (SELECT 1 FROM calls c
                   WHERE c.lead_id = l.id AND c.direction = 'outbound')
ORDER  BY waiting DESC;`;

/* ---------- Response time by month ---------- */

export const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

export const responseBySegment = {
  daytime: [8, 9, 9, 9, 9],
  evening: [11, 13, 12, 61, 22],
};

export const teamMedianResponse = [9, 11, 10, 27, 14];

/* ---------- Board-only answers ---------- */

export const newLeadsByDay = [
  { label: 'Mon', value: 14 },
  { label: 'Tue', value: 11 },
  { label: 'Wed', value: 10 },
  { label: 'Thu*', value: 3, partial: true },
];

export const dealsClosing = [
  { date: 'Nov 3', address: '18 Larkspur Ln', status: 'Clear to close', urgent: false },
  { date: 'Nov 5', address: '402 Quarry Bend Dr', status: 'Inspection reply Oct 30', urgent: true },
  { date: 'Nov 7', address: '77 Willow Oak Ct', status: 'Financing due Nov 1', urgent: true },
  { date: 'Nov 10', address: '1250 Ashby Ridge Rd', status: 'Appraisal pending', urgent: false },
  { date: 'Nov 12', address: '9 Fenwick Pl', status: 'On track', urgent: false },
];

export const appointmentsByAgent = [
  { label: 'Priya Shah', value: 5 },
  { label: 'Jordan Reyes', value: 3 },
  { label: 'Marcus Bell', value: 2 },
  { label: '6 other agents', value: 4, other: true },
];

/* ---------- Question routing ---------- */

export type Resolution =
  | { kind: 'answer'; to: string }
  | { kind: 'ambiguous' }
  | { kind: 'unknown' };

/** Matches a typed question to one of the demo answers. */
export function resolveQuestion(question: string): Resolution {
  const q = question.toLowerCase();
  if (/lead source|source.*clos|clos.*source/.test(q)) return { kind: 'answer', to: '/answer/lead-sources' };
  if (/call(ed)?\b.*lead|uncalled|haven.?t called|no call/.test(q)) return { kind: 'answer', to: '/thread/monday#uncalled' };
  if (/response|respond/.test(q)) return { kind: 'answer', to: '/thread/monday#response-slip' };
  if (/new leads|leads came in/.test(q)) return { kind: 'answer', to: '/board#new-leads' };
  if (/deal|contingenc|clos(e|ing) in/.test(q)) return { kind: 'answer', to: '/board#deals-closing' };
  if (/appointment/.test(q)) return { kind: 'answer', to: '/board#appointments' };
  if (/how are we doing|how.?s it going|doing this/.test(q)) return { kind: 'ambiguous' };
  return { kind: 'unknown' };
}

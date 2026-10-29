/** Questions offered on the home page. Each is asked live against the CRM data. */
export const starterGroups: { topic: string; questions: string[] }[] = [
  {
    topic: 'Leads',
    questions: ['Which lead sources closed best last quarter?', 'How many new leads came in this week?'],
  },
  {
    topic: 'Agents',
    questions: ["Who hasn't called their new leads this week?", 'Why did evening response time slip last month?'],
  },
  {
    topic: 'Deals',
    questions: ['Which deals close in the next 14 days?', 'Which contingencies are due this week?'],
  },
];

export const currentUser = {
  name: 'Morgan Lee',
  initials: 'ML',
  role: 'Team lead · Demo team',
};

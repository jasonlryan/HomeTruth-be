const MIN_PARTICIPANTS = 10;
const MIN_CELL = 5;
const METRICS = Object.freeze([
  { key: 'activation', label: 'Activation', events: ['signup_completed'], definition: 'Eligible participants with a recorded signup completion in this month.' },
  { key: 'propertySetup', label: 'Property setup', events: ['property_setup_completed'], definition: 'Eligible participants with a recorded property setup completion in this month.' },
  { key: 'documents', label: 'Document linking', events: ['document_linked'], definition: 'Eligible participants who linked at least one document in this month.' },
  { key: 'taskGeneration', label: 'Task generation', events: ['tasks_generated'], definition: 'Eligible participants with recorded task generation in this month.' },
  { key: 'taskEngagement', label: 'Task engagement', events: ['task_completed', 'task_dismissed', 'task_not_relevant'], definition: 'Eligible participants who completed, dismissed or marked a task not relevant in this month.' },
  { key: 'propertyQuestions', label: 'Property-aware questions', events: ['property_chat_question'], definition: 'Eligible participants with a recorded property-aware question in this month.' },
  { key: 'repeatUse', label: 'Repeat use', events: ['pilot_daily_activity'], definition: 'Eligible participants active on at least two distinct UTC days in this month.' },
  { key: 'feedback', label: 'Feedback participation', events: ['user_feedback_submitted'], definition: 'Eligible participants who submitted feedback in this month. Content and ratings are excluded.' },
]);
const definitions = () => ({
  version: 'partner-evidence-v1',
  minimumParticipants: MIN_PARTICIPANTS,
  minimumCell: MIN_CELL,
  denominator: 'Distinct current cohort participants with current processing, analytics and partner-reporting consent, joined before month end. Withdrawn and removed participants are excluded, including their historical events.',
  periods: 'Complete UTC calendar months only. Campaign partitions do not overlap; no programme total is returned.',
  interpretation: 'Recorded engagement only; these measures do not establish prevention, claims, credit or financial outcomes. Missing activity can reflect consent choices or incomplete instrumentation.',
  metrics: METRICS.map(({ key, label, definition, events }) => ({ key, label, definition, sources: events, coverage: 'instrumented', unit: 'distinct participants', denominator: 'eligible participants' })),
});
function parseFilters(input = {}, now = new Date()) {
  if (Object.keys(input).some((key) => !['month', 'campaignId'].includes(key))) throw new Error('Only month and campaignId filters are supported');
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const month = input.month === undefined ? previous.toISOString().slice(0, 7) : input.month;
  if (typeof month !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('month must be YYYY-MM');
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  if (end > now) throw new Error('Select a complete calendar month');
  let campaignId;
  if (input.campaignId !== undefined) {
    if (typeof input.campaignId !== 'string' || !/^[1-9]\d*$/.test(input.campaignId) || !Number.isSafeInteger(Number(input.campaignId))) throw new Error('campaignId must be a positive integer');
    campaignId = Number(input.campaignId);
  }
  return { month, start, end, campaignId };
}
function aggregate(eligibleIds, events) {
  const eligible = new Set(eligibleIds);
  const denominator = eligible.size;
  if (denominator < MIN_PARTICIPANTS) return { state: denominator === 0 ? 'no_data' : 'suppressed', eligibleParticipants: null, metrics: [] };
  const metrics = METRICS.map((metric) => {
    const participants = new Set();
    const days = new Map();
    for (const event of events) {
      if (!eligible.has(event.cohort_member_id) || !metric.events.includes(event.event_name)) continue;
      if (metric.key === 'repeatUse') {
        const day = event.activity_date;
        if (!day) continue;
        if (!days.has(event.cohort_member_id)) days.set(event.cohort_member_id, new Set());
        days.get(event.cohort_member_id).add(day);
      } else participants.add(event.cohort_member_id);
    }
    if (metric.key === 'repeatUse') for (const [id, dates] of days) if (dates.size >= 2) participants.add(id);
    const count = participants.size;
    const complement = denominator - count;
    const suppressed = (count > 0 && count < MIN_CELL) || (complement > 0 && complement < MIN_CELL);
    return { key: metric.key, state: suppressed ? 'suppressed' : 'measured', count: suppressed ? null : count, rate: suppressed ? null : Math.round(count / denominator * 1000) / 10 };
  });
  return { state: 'available', eligibleParticipants: denominator, metrics };
}
module.exports = { METRICS, definitions, parseFilters, aggregate };

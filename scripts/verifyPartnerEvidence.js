const assert = require('node:assert/strict');
const { parseFilters, aggregate, definitions } = require('../services/partnerEvidenceContract');
const now = new Date('2026-10-25T00:00:00Z');
assert.equal(parseFilters({}, now).month, '2026-09');
for (const input of [{ month: '2026-10' }, { month: '2026-13' }, { month: ['2026-09'] }, { campaignId: '1 OR 1=1' }, { start: '2026-09-01' }, { period: '30d' }]) assert.throws(() => parseFilters(input, now));
assert.equal(parseFilters({ month: '2026-09', campaignId: '4' }, now).campaignId, 4);
assert.equal(aggregate([], []).state, 'no_data');
assert.deepEqual(aggregate([1, 2], []), { state: 'suppressed', eligibleParticipants: null, metrics: [] });
const ids = Array.from({ length: 10 }, (_, i) => i + 1);
const events = (n, name) => ids.slice(0, n).flatMap((id) => [{ cohort_member_id: id, event_name: name }, { cohort_member_id: id, event_name: name }]);
for (const [count, state] of [[0, 'measured'], [1, 'suppressed'], [4, 'suppressed'], [5, 'measured'], [6, 'suppressed'], [9, 'suppressed'], [10, 'measured']]) {
  const metric = aggregate(ids, events(count, 'signup_completed')).metrics[0];
  assert.equal(metric.state, state);
  assert.equal(metric.count, state === 'suppressed' ? null : count);
  assert.equal(metric.rate, state === 'suppressed' ? null : count * 10);
}
const daily = ids.slice(0, 5).flatMap((id) => ['2026-09-01', '2026-09-01', '2026-09-02'].map((day) => ({ cohort_member_id: id, event_name: 'pilot_daily_activity', activity_date: day })));
assert.equal(aggregate(ids, daily).metrics.find((item) => item.key === 'repeatUse').count, 5);
assert.equal(aggregate(ids, [{ cohort_member_id: 999, event_name: 'signup_completed' }]).metrics[0].count, 0);
assert.equal(definitions().metrics.length, 8);
console.log('Partner evidence contract passed: calendar windows, filters, distinct participation, repeat days, group/cell/complement suppression and coverage.');

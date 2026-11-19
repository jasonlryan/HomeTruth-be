const { QueryTypes, Op } = require('sequelize');
const { createHash } = require('node:crypto');
const { ItemError } = require('./itemContract');
const { assertSameIdentity } = require('./applianceManualPolicy');

const interruptedMs = 180000;

function identityFor(user, home, item, brand, model, entry) {
  const binding = [user, home, item, entry.agent, entry.operation, brand, model];
  return {
    agent: entry.agent, operation: entry.operation, revision: entry.revision, homeId: home,
    fingerprint: createHash('sha256').update(JSON.stringify(binding)).digest('hex')
  };
}

async function reserve({ Run, policy, key, identity, execution, paid }) {
  const db = Run.sequelize;
  return db.transaction(async transaction => {
    const options = { transaction, type: QueryTypes.SELECT };
    // The principal exists before the first lookup. Its row serialises admissions
    // across items, workers and the daily budget boundary without a global mutex.
    const principals = await db.query('SELECT id FROM users WHERE id = :user FOR UPDATE', {
      ...options, replacements: { user: key.user_id }
    });
    if (!principals.length) throw new ItemError('Access unavailable', 403);
    const existing = await Run.findOne({ where: key, transaction, lock: transaction.LOCK.UPDATE });
    if (existing) {
      assertSameIdentity({ record: { identity } }, existing.identity);
      if (existing.execution && existing.execution.fingerprint !== execution.fingerprint) {
        throw new ItemError('Request key is bound to a different lookup.', 409);
      }
      return [existing, false];
    }
    if (!policy.enabled) throw new ItemError('New appliance lookups are disabled.', 503);
    const [clock] = await db.query('SELECT UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS ms, UTC_DATE() AS day', options);
    const now = Number(clock.ms);
    if (paid) {
      const active = await Run.count({ where: { user_id: key.user_id, status: 'running',
        updatedAt: { [Op.gt]: new Date(now - interruptedMs) } }, transaction });
      if (active >= policy.maxConcurrent) throw new ItemError('Concurrent lookup limit reached.', 429);
      const replacements = { user: key.user_id, day: clock.day, charge: policy.lookupMicros };
      const [spend] = await db.query('SELECT reserved_micros FROM agent_daily_spend WHERE user_id=:user AND utc_day=:day', {
        ...options, replacements
      });
      if (Number(spend?.reserved_micros || 0) > policy.dailyMicros - policy.lookupMicros) {
        throw new ItemError('Daily lookup budget reached.', 429);
      }
      await db.query('INSERT INTO agent_daily_spend (user_id, utc_day, reserved_micros) VALUES (:user,:day,:charge) ON DUPLICATE KEY UPDATE reserved_micros = reserved_micros + :charge', { transaction, replacements });
    }
    const run = await Run.create({ ...key, status: 'running', identity, execution: {
      ...execution, startedMs: now, reservedMicros: paid ? policy.lookupMicros : 0
    } }, { transaction });
    return [run, true];
  });
}

module.exports = { interruptedMs, identityFor, reserve };

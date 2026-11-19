// Prices are operator-approved reservation amounts in millionths of a USD.
// They are an internal spend allocation, independent of provider invoice settlement.
function positive(env, name, maximum = Number.MAX_SAFE_INTEGER) {
  const value = Number(env[name]);
  if (!/^[1-9]\d*$/.test(String(env[name])) || !Number.isSafeInteger(value) || value > maximum) {
    throw new Error('Invalid or missing ' + name);
  }
  return value;
}

function readPolicy(env = process.env) {
  const enabled = env.APPLIANCE_AGENT_ENABLED ?? 'false';
  if (!['true', 'false'].includes(enabled)) throw new Error('Invalid APPLIANCE_AGENT_ENABLED');
  const revision = positive({ ...env, APPLIANCE_AGENT_REVISION: env.APPLIANCE_AGENT_REVISION ?? '1' }, 'APPLIANCE_AGENT_REVISION');
  const maximum = require('../agent-runtime/manualContract');
  const limits = { ...maximum };
  for (const [name, field] of Object.entries({
    APPLIANCE_AGENT_DEADLINE_MS:'deadlineMs', APPLIANCE_AGENT_MAX_TURNS:'maxTurns',
    APPLIANCE_AGENT_MAX_TOOL_CALLS:'maxToolCalls', APPLIANCE_AGENT_MAX_OUTPUT_TOKENS:'maxOutputTokens'
  })) {
    if (env[name] !== undefined) limits[field] = positive(env, name, maximum[field]);
  }
  if (enabled === 'false') return { enabled: false, revision, limits };
  const maxConcurrent = positive(env, 'APPLIANCE_AGENT_MAX_CONCURRENT');
  const dailyMicros = positive(env, 'APPLIANCE_AGENT_DAILY_USD_MICROS');
  const lookupMicros = positive(env, 'APPLIANCE_AGENT_LOOKUP_USD_MICROS', dailyMicros);
  return { enabled: true, revision, limits, maxConcurrent, dailyMicros, lookupMicros };
}

module.exports = { readPolicy };

// Reservations are integer millionths of the selected market currency.
const markets = new Map([
  ['GBP', { active: true, maxConcurrent: 1, dailyMicros: 1000000, lookupMicros: 200000 }],
  ['EUR', { active: false }],
  ['USD', { active: false }]
]);
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
  const currency = env.APPLIANCE_AGENT_BUDGET_CURRENCY ?? 'GBP';
  const market = markets.get(currency);
  if (!market) throw new Error('Unsupported appliance budget currency');
  if (enabled === 'false' || !market.active) return { enabled: false, currency, revision, limits };
  if (env.APPLIANCE_AGENT_DAILY_USD_MICROS || env.APPLIANCE_AGENT_LOOKUP_USD_MICROS) {
    throw new Error('Remove legacy USD budget settings before enabling the UK pilot.');
  }
  const config = {
    APPLIANCE_AGENT_MAX_CONCURRENT: market.maxConcurrent,
    APPLIANCE_AGENT_DAILY_MICROS: market.dailyMicros,
    APPLIANCE_AGENT_LOOKUP_MICROS: market.lookupMicros,
    ...env
  };
  const maxConcurrent = positive(config, 'APPLIANCE_AGENT_MAX_CONCURRENT', market.maxConcurrent);
  const dailyMicros = positive(config, 'APPLIANCE_AGENT_DAILY_MICROS', market.dailyMicros);
  const lookupMicros = positive(config, 'APPLIANCE_AGENT_LOOKUP_MICROS', dailyMicros);
  return { enabled: true, currency, revision, limits, maxConcurrent, dailyMicros, lookupMicros };
}

module.exports = { readPolicy };

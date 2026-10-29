const axios = require('axios');
const env = require('../config/env');
const { ItemError } = require('./itemContract');
const createIntelligence = require('./itemIntelligence');
const runtime = require('../agent-runtime').createRuntime({ apiKey: env.ai.OpenAIKey, model: env.openaiLlm.model, searchModel: process.env.APPLIANCE_AGENT_SEARCH_MODEL || 'gpt-5-mini' });
module.exports = createIntelligence({
  async complete(input) {
    try { return await runtime.complete(input); }
    catch { throw new ItemError('The appliance agent could not analyse this source. Your record has not been changed. Try another source.', 502); }
  },
  // Require an explicitly configured key, not the legacy property's hardcoded default.
  search: process.env.SERPAPI_KEY ? async query => {
    try {
      const r = await axios.get('https://serpapi.com/search', { params: { q: query, api_key: process.env.SERPAPI_KEY, engine: 'google', gl: 'uk', num: 8 }, timeout: 15000 });
      return r.data?.organic_results || [];
    } catch { throw new ItemError('Online lookup could not be completed. Try a label photo or selected receipt text.', 502); }
  } : null,
});

module.exports.applianceRuntime = runtime;

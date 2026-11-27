const env = require('../config/env');
const { ItemError } = require('./itemContract');
const createIntelligence = require('./itemIntelligence');
const runtime = require('../agent-runtime').createRuntime({ apiKey: env.ai.OpenAIKey, model: env.openaiLlm.model, searchModel: process.env.APPLIANCE_AGENT_SEARCH_MODEL || 'gpt-5-mini' });
module.exports = createIntelligence({
  async complete(input) {
    try { return await runtime.complete(input); }
    catch { throw new ItemError('The appliance agent could not analyse this source. Your record has not been changed. Try another source.', 502); }
  },
  search: async query => {
    try { return await runtime.discoverProduct(query,require('./applianceManualPolicy').manufacturerDomains); }
    catch { throw new ItemError('The appliance agent could not complete online identification. Try a label photo or selected receipt text.',502); }
  },
});

module.exports.applianceRuntime = runtime;

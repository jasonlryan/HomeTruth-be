const OpenAI = require('openai');
const axios = require('axios');
const env = require('../config/env');
const { ItemError } = require('./itemContract');
const createIntelligence = require('./itemIntelligence');
const client = new OpenAI({ apiKey: env.ai.OpenAIKey, timeout: 45000, maxRetries: 0 });
module.exports = createIntelligence({
  async complete({ instruction, text, image }) {
    try {
      const content = [{ type: 'text', text: text || 'Read the supplied label image.' }];
      if (image) content.push({ type: 'image_url', image_url: { url: image } });
      const result = await client.chat.completions.create({ model: env.openaiLlm.model, response_format: { type: 'json_object' }, temperature: 0, max_tokens: 2500, messages: [{ role: 'system', content: instruction }, { role: 'user', content }] });
      return JSON.parse(result.choices[0].message.content);
    } catch { throw new ItemError('The source could not be analysed. Your record has not been changed. Try another source.', 502); }
  },
  // Require an explicitly configured key, not the legacy property's hardcoded default.
  search: process.env.SERPAPI_KEY ? async query => {
    try {
      const r = await axios.get('https://serpapi.com/search', { params: { q: query, api_key: process.env.SERPAPI_KEY, engine: 'google', gl: 'uk', num: 8 }, timeout: 15000 });
      return r.data?.organic_results || [];
    } catch { throw new ItemError('Online lookup could not be completed. Try a label photo or selected receipt text.', 502); }
  } : null,
});

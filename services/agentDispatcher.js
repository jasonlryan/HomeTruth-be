const Joi = require('joi');

module.exports = function createDispatcher(operations, activeRevisions = {}) {
  const registry = new Map();
  for (const entry of operations) {
    const { agent, operation, revision, input, output, execute } = entry;
    if (![agent, operation].every(name => typeof name === 'string' && /^[a-z][a-zA-Z0-9-]*$/.test(name)) ||
        !Number.isSafeInteger(revision) || revision < 1 ||
        !Joi.isSchema(input) || !Joi.isSchema(output) || typeof execute !== 'function') {
      throw new Error('Invalid agent operation registration');
    }
    const key = agent + '/' + operation;
    const limits = entry.limits;
    const maximum = require('../agent-runtime/manualContract');
    if (!limits || !['maxTurns', 'maxToolCalls', 'maxOutputTokens', 'deadlineMs'].every(
      field => Number.isSafeInteger(limits[field]) && limits[field] > 0 && limits[field] <= maximum[field]
    ) || !Array.isArray(limits.tools) || limits.tools.some(tool => !maximum.tools.includes(tool))) {
      throw new Error('Invalid agent limits or tool capabilities');
    }
    if (!registry.has(key)) registry.set(key, new Map());
    const revisions = registry.get(key);
    if (revisions.has(revision)) throw new Error('Duplicate active agent operation: ' + key);
    revisions.set(revision, Object.freeze({ ...entry, limits: Object.freeze({ ...limits, tools: Object.freeze([...limits.tools]) }) }));
  }

  const active = new Map();
  for (const [key, revisions] of registry) {
    const revision = activeRevisions[key] ?? 1;
    if (!revisions.has(revision)) throw new Error('Unknown active revision for ' + key);
    active.set(key, revisions.get(revision));
  }

  return {
    async invoke({ agent, operation, context, input }) {
      const key = agent + '/' + operation;
      const entry = active.get(key);
      if (!entry) throw new Error('Unknown agent operation');
      const request = entry.input.required().validate(input, { convert: false });
      if (request.error) throw Object.assign(new Error(request.error.details[0].message), { statusCode: 400 });
      const result = await entry.execute(context, request.value, entry);
      const reader = registry.get(key).get(result?.revision);
      if (!reader) throw new Error('Invalid result revision');
      const response = reader.output.required().validate(result, { convert: false });
      if (response.error) throw new Error('Invalid result from ' + reader.agent + '@' + reader.revision + '/' + entry.operation);
      return response.value;
    }
  };
};

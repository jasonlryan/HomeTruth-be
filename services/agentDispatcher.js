const Joi = require('joi');

module.exports = function createDispatcher(operations) {
  const registry = new Map();
  for (const entry of operations) {
    const { agent, operation, revision, input, output, execute } = entry;
    if (![agent, operation].every(name => typeof name === 'string' && /^[a-z][a-zA-Z0-9-]*$/.test(name)) ||
        !Number.isSafeInteger(revision) || revision < 1 ||
        !Joi.isSchema(input) || !Joi.isSchema(output) || typeof execute !== 'function') {
      throw new Error('Invalid agent operation registration');
    }
    const key = agent + '/' + operation;
    if (registry.has(key)) throw new Error('Duplicate active agent operation: ' + key);
    registry.set(key, Object.freeze({ ...entry }));
  }

  return {
    async invoke({ agent, operation, context, input }) {
      const entry = registry.get(agent + '/' + operation);
      if (!entry) throw new Error('Unknown agent operation');
      const request = entry.input.required().validate(input, { convert: false });
      if (request.error) throw Object.assign(new Error(request.error.details[0].message), { statusCode: 400 });
      const result = await entry.execute(context, request.value);
      const response = entry.output.required().validate(result, { convert: false });
      if (response.error) throw new Error('Invalid result from ' + entry.agent + '@' + entry.revision + '/' + entry.operation);
      return response.value;
    }
  };
};

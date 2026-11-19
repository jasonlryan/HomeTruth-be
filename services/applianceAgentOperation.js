const Joi = require('joi');
const { id } = require('./itemContract');

const identifier = Joi.number().integer().positive();
const candidate = Joi.object({
  title: Joi.string().allow('').required(),
  url: Joi.string().uri({ scheme: ['https'] }).required(),
  model: Joi.string().required(),
  quote: Joi.string().required(),
  kind: Joi.string().valid('pdf', 'support_page').required(),
  matchStatus: Joi.string().valid('needs_review').required()
});

module.exports = function applianceAgentOperation(findManual) {
  return {
    agent: 'appliance-information',
    revision: 1,
    operation: 'findManual',
    input: Joi.object({ requestKey: Joi.string().guid().required() }),
    output: Joi.object({
      id: identifier.required(),
      identity: Joi.object({ brand: Joi.string().required(), model: Joi.string().required() }).required(),
      status: Joi.string().valid('running', 'needs_review', 'no_match', 'failed', 'importing', 'saved').required(),
      agent: Joi.string().required(),
      updatedAt: Joi.date().required(),
      candidates: Joi.array().items(candidate).max(4),
      brand: Joi.string(),
      model: Joi.string(),
      officialFinder: Joi.string().allow(null),
      manualLibrarySearch: Joi.string(),
      searchLink: Joi.string(),
      notice: Joi.string(),
      limitations: Joi.string().allow(''),
      usage: Joi.object({ modelCalls: Joi.number().integer().min(0), totalTokens: Joi.number().integer().min(0) }),
      documentId: identifier,
      savedCandidateIndex: Joi.number().integer().min(0).max(3)
    }),
    execute({ principal, homeId, itemId }, input) {
      return findManual(id(principal), id(homeId), id(itemId), input);
    }
  };
};

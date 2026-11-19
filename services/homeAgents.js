const createDispatcher = require('./agentDispatcher');
const createApplianceService = require('./applianceAgentService');
const applianceAgentOperation = require('./applianceAgentOperation');

module.exports = function createHomeAgents(dependencies) {
  const applianceAgent = createApplianceService(dependencies);
  const agents = createDispatcher([applianceAgentOperation(applianceAgent.start)]);
  return { agents, applianceAgent };
};

const createDispatcher = require('./agentDispatcher');
const createApplianceService = require('./applianceAgentService');
const applianceAgentOperation = require('./applianceAgentOperation');

module.exports = function createHomeAgents(dependencies) {
  const policy = require('./agentExecutionPolicy').readPolicy(dependencies.policyEnv);
  const applianceAgent = createApplianceService({ ...dependencies, policy });
  const agents = createDispatcher([{ ...applianceAgentOperation(applianceAgent.start), limits: policy.limits }], { 'appliance-information/findManual': policy.revision });
  return { agents, applianceAgent };
};

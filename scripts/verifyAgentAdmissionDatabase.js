const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const createHomeAgents = require('../services/homeAgents');
const createDispatcher = require('../services/agentDispatcher');
const operation = require('../services/applianceAgentOperation');

// Called only inside verifyHomeItemsDatabase's synthetic schema.
module.exports = async function verifyAdmission({ db, Run, itemId, items, policyEnv }) {
  const principal = 1, homeId = 42;
  const call = (agents, requestKey) => agents.invoke({
    agent: 'appliance-information', operation: 'findManual', context: { principal, homeId, itemId }, input: { requestKey }
  });
  const maxOne = { ...policyEnv, APPLIANCE_AGENT_MAX_CONCURRENT:'1' };
  const result = { candidates:[], sourceUrls:[], usage:{modelCalls:1,totalTokens:19} };
  let entered, finish;
  const started = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { finish = resolve; });
  const make = (env, findManual, resource = items) => createHomeAgents({
    Run, items:resource, policyEnv:env, runtime:{findManual}, importManual:async()=>5
  });
  const first = make(maxOne, async () => { entered(); await held; return result; });
  const other = make(maxOne, async () => result);
  const key = randomUUID();
  const pending = call(first.agents,key);
  await started;
  try {
    assert.equal((await call(other.agents,key)).status,'running');
    await assert.rejects(call(other.agents,randomUUID()), {statusCode:429});
  } finally { finish(); }
  const completed = await pending;
  const row = await Run.findByPk(completed.id);
  assert.equal(row.execution.homeId,homeId);
  assert.equal(row.execution.operation,'findManual');
  assert.equal(row.execution.fingerprint.length,64);
  assert.equal(row.execution.revision,1);
  assert.ok(row.finished_at);
  assert.deepEqual(row.usage,result.usage);
  const disabled = make({}, async()=>{ throw Error('unexpected paid call'); });
  assert.equal((await call(disabled.agents,key)).id,row.id);
  await assert.rejects(call(disabled.agents,randomUUID()), {statusCode:503});
  const changed = make(maxOne,async()=>result,{find:async()=>({record:{identity:{brand:'Bosch',model:'changed'}}})});
  await assert.rejects(call(changed.agents,key),{statusCode:409});

  const entry = operation(other.applianceAgent.start);
  const v2 = {...entry,revision:2};
  const revisions = rev => createDispatcher([entry,v2],{'appliance-information/findManual':rev});
  const rollbackKey = randomUUID();
  assert.equal((await call(revisions(2),rollbackKey)).revision,2);
  assert.equal((await call(revisions(1),rollbackKey)).revision,2);
  assert.equal((await call(revisions(1),randomUUID())).revision,1);

  const legacyKey = randomUUID();
  await Run.create({user_id:principal,item_id:itemId,request_key:legacyKey,status:'no_match',identity:row.identity});
  assert.equal((await call(disabled.agents,legacyKey)).revision,1);

  let authorised = true;
  const revocation = make(maxOne, async()=>{authorised=false; return result;},{
    find(...args) { if (!authorised) throw Object.assign(Error('revoked'),{statusCode:403}); return items.find(...args); }
  });
  const revokedKey = randomUUID();
  await assert.rejects(call(revocation.agents,revokedKey),{statusCode:403});
  const revoked = await Run.findOne({where:{request_key:revokedKey}});
  assert.equal(revoked.status,'failed');
  assert.deepEqual(revoked.usage,result.usage);

  const timeout = make({...maxOne,APPLIANCE_AGENT_DEADLINE_MS:'20'},({signal}) => new Promise((resolve,reject) => {
    signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
  }));
  assert.equal((await call(timeout.agents,randomUUID())).status,'failed');
  assert.equal((await call(other.agents,randomUUID())).status,'no_match');

  const [[{ spent }]] = await db.query('SELECT SUM(reserved_micros) AS spent FROM agent_daily_spend');
  const lastCharge = make({...maxOne, APPLIANCE_AGENT_MAX_CONCURRENT:'3', APPLIANCE_AGENT_DAILY_USD_MICROS:String(Number(spent)+10)},async()=>result);
  const attempts = await Promise.allSettled([call(lastCharge.agents,randomUUID()), call(lastCharge.agents,randomUUID())]);
  assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);
  assert.equal(attempts.find(a=>a.status==='rejected').reason.statusCode,429);

  const invalidKey = randomUUID();
  const name = 'ht351_fixture_failure';
  Run.addHook('beforeCreate',name,run=>{if(run.request_key===invalidKey) throw Error('injected insert failure');});
  const spend = async () => (await db.query('SELECT reserved_micros FROM agent_daily_spend'))[0];
  const before = await spend();
  try { await assert.rejects(call(other.agents,invalidKey),/injected insert failure/); }
  finally { Run.removeHook('beforeCreate',name); }
  assert.deepEqual(await spend(),before);
  assert.equal(await Run.count({where:{request_key:invalidKey}}),0);
  assert.equal((await call(other.agents,invalidKey)).status,'no_match');
};

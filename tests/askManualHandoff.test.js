const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { isManualRequest } = require('../services/askManualHandoff');

test('recognises locating a manual and keeps content questions conversational', () => {
  for (const question of ['get me my washing machine manual', 'Can you find the manual for my washing machine?', 'Do you have my washer manual?',
    'Where can I find the user guide?', 'I can’t find my dishwasher manual', 'Please get the manufacturer’s manual']) {
    assert.equal(isManualRequest(question), true, question);
  }
  for (const question of ['What does my saved manual say about the filter?', 'Find the error code in my manual',
    'Show me how to clean it using the manual', 'Find a manual transmission car', 'Do not find the manual',
    'How do I repair my dishwasher?', 'Find my warranty']) {
    assert.equal(isManualRequest(question), false, question);
  }
});

test('guest and signed-in Ask offer the same navigation action without search or execution', async () => {
  const saved = [];
  const scope = [];
  const history = {
    count: async () => 0, findAll: async () => [],
    create: async data => { saved.push(data); return { ...data, id: 1 }; },
    findAndCountAll: async () => ({ count: 1, rows: [saved.at(-1)] })
  };
  const dependencies = {
    openai: class {}, sequelize: {Op:{}},
    '../../models/index': {User:{findByPk:async()=>({id:7})}, ChatHistory:history, GuestChatSession:history},
    '../../config/env': {ai:{OpenAIKey:'test'}}, '../../services/vectorStore': {},
    '../../services/webSearchService': {}, '../../services/pilotAnalyticsService': {recordEvent:async()=>{}},
    '../../services/unifiedRetrievalService': {actionContext:async(user,property)=>{
      scope.push([user,property]);
      if (property===99) throw Object.assign(Error('Property record not found'),{name:'UnifiedRetrievalAccessError',statusCode:404});
      return {sourceSummary:{sourceClasses:[]},scope:{user,property}};
    }}
  };
  const base = path.resolve(__dirname,'../Controllers/AI');
  const sandbox = {module:{exports:{}},console,process:{env:{HT356_ASK_MANUAL_HANDOFF:'true'}}, require:name => dependencies[name] ?? require(path.resolve(base,name))};
  vm.runInNewContext(fs.readFileSync(path.join(base,'ai_chat.js'),'utf8'),sandbox);
  const api = sandbox.module.exports;
  const request = async (handler, req, status) => {
    let code;
    const res = {status(n){code=n;return this;},json(value){return JSON.parse(JSON.stringify(value));}};
    const result = await handler(req,res);
    assert.equal(code,status,JSON.stringify(result));
    return result.data;
  };
  const body = {userMessage:'Find my washer manual', search_web:true, propertyId:42, itemId:8, confirmed:true};
  const guest = await request(api.handleAnonymousChat,{body},200);
  const auth = await request(api.handleChat,{user:{id:7},body},201);
  assert.deepEqual(auth.actions,[{actionId:'find_appliance_manual'}]);
  assert.deepEqual(guest.actions,auth.actions);
  assert.equal(auth.webSearch.performed,false);
  assert.deepEqual(scope,[[7,42]]);
  const historyResponse = await request(api.getUserChatHistory,{user:{id:7},query:{}},200);
  const turn = Object.values(historyResponse.conversations)[0].messages[0];
  assert.deepEqual(turn.actions,auth.actions);
  await request(api.handleChat,{user:{id:7},body:{...body,propertyId:99}},404);
  assert.equal(saved.length,2);
});

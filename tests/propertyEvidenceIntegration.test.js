const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('document retrieval activates review before response and persistence',async()=>{
 const calls=[]; let persisted;
 class OpenAI { constructor(){this.chat={completions:{create:async request=>{
  calls.push(request);
  return {choices:[{finish_reason:'stop',message:{content:calls.length===1?'You paid £360.':'{"answer":"The invoice total is £360. Payment is not recorded; internal condition is unassessed."}'}}]};
 }}};}}
 const history={count:async()=>0,findAll:async()=>[],create:async data=>{persisted=data;return {...data,id:1,createdAt:new Date()};}};
 const retrieval={assembleAssistantContext:async()=>({contextText:'Invoice total £360. Payment not recorded. No internal assessment.',sourceSummary:{sourceClasses:['uploaded_user_document'],uploadedUserDocuments:1,errors:[]},scope:{}})};
 const sandbox={module:{exports:{}},console,require:name=>{
  if(name==='openai')return OpenAI;
  if(name==='../../models/index')return {ChatHistory:history,User:{findByPk:async()=>({id:173})}};
  if(name==='sequelize')return {Op:{}};
  if(name.endsWith('/config/env'))return {ai:{OpenAIKey:'test'}};
  if(name.endsWith('/unifiedRetrievalService'))return retrieval;
  if(name.endsWith('/pilotAnalyticsService'))return {recordEvent:async()=>{}};
  if(name.endsWith('/webSearchService')||name.endsWith('/vectorStore'))return {};
  return require(path.resolve(__dirname,'../Controllers/AI',name));
 }};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../Controllers/AI/ai_chat.js'),'utf8'),sandbox);
 let output,status;
 const res={status:n=>{status=n;return res;},json:data=>{output=data;return data;}};
 await sandbox.module.exports.handleChat({user:{id:173},body:{userMessage:'Did I pay?',propertyId:31}},res);
 assert.equal(status,201,JSON.stringify(output));
 assert.equal(calls.length,2,'Must review actual uploaded-document retrieval results');
 assert.equal(persisted.assistantReply,'The invoice total is £360. Payment is not recorded; internal condition is unassessed.');
 assert.equal(output.data.savedChat.assistantReply,persisted.assistantReply);
});

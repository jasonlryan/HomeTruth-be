const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { chatPagination } = require('../utils/chatPagination');

function controller(models) {
  const file = path.join(__dirname, '../Controllers/userDocumentChatController.js');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module, console, setTimeout,
    require(name) {
      if (name === '../models') return models;
      if (name === '../utils/chatPagination') return { chatPagination };
      if (name === '../config/env') return { ai: { OpenAIKey: 'test' } };
      if (name === 'openai') return class {};
      if (name === 'uuid') return { v4: () => 'test-conversation' };
      return {};
    },
    process: { env: {} },
  });
  return module.exports;
}
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('pagination bounds and defaults reject malformed and oversized requests', () => {
  assert.deepEqual(chatPagination(), { page: 1, limit: 20, offset: 0 });
  assert.deepEqual(chatPagination({ page: '2', limit: '100' }), { page: 2, limit: 100, offset: 100 });
  for (const query of [{page:0},{page:-1},{page:'1x'},{page:1.5},{limit:0},{limit:101},{limit:'foo'},{page:[]},{page:Number.MAX_SAFE_INTEGER,limit:100}]) assert.equal(chatPagination(query), null);
});

test('document history remains user scoped, bounded and chronologically displayed', async () => {
  let options;
  const api = controller({
    UserDocument: { findOne: async query => { assert.equal(query.where.user_id, 7); return { id: 9, name: 'manual' }; } },
    UserDocumentChatHistory: { findAll: async query => { options = query; return [3,2,1].map(id => ({id, conversation_id:'a',created_at:'now'})); } },
  });
  const res = response();
  await api.getDocumentChatHistory({ params:{id:9},user:{id:7},query:{page:'2',limit:'2',conversation_id:'a'} },res);
  assert.equal(options.where.user_id,7);
  assert.equal(options.where.document_id,9);
  assert.equal(options.where.conversation_id,'a');
  assert.equal(options.limit,3);
  assert.equal(options.offset,2);
  assert.equal(JSON.stringify(options.order),JSON.stringify([['created_at','DESC'],['id','DESC']]));
  assert.equal(JSON.stringify(res.body.data.chat_history.map(row=>row.id)), '[2,3]');
  assert.equal(res.body.data.pagination.has_next_page,true);
});

test('invalid pagination and inaccessible documents never query chat rows', async () => {
  let reads=0;
  const api=controller({UserDocument:{findOne:async()=>null},UserDocumentChatHistory:{findAll:async()=>{reads++;return [];}}});
  const bad=response();
  await api.getDocumentChatHistory({params:{id:9},user:{id:7},query:{limit:1000}},bad);
  assert.equal(bad.statusCode,400);
  const denied=response();
  await api.getDocumentChatHistory({params:{id:9},user:{id:7},query:{}},denied);
  assert.equal(denied.statusCode,404);
  assert.equal(reads,0);
});

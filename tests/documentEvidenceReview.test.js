const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reviewDocumentAnswer, FALLBACK } = require('../services/documentEvidenceReview');
const input={model:'test',question:'Was it paid?',context:'Payment not recorded.',answer:'You paid.'};
const client = (content,finish_reason='stop') => ({chat:{completions:{create:async()=>({choices:[{finish_reason,message:{content}}]})}}});
test('returns the checked answer rather than the unsupported draft',async()=>{
 assert.equal(await reviewDocumentAnswer({...input,client:client('{"answer":"Payment is unknown."}')}),'Payment is unknown.');
});
test('fails closed for invalid, empty, truncated and unavailable review',async()=>{
 for(const c of [client('invalid'),client('{}'),client('{"answer":""}'),client('{"answer":"You paid"}','length'),{chat:{completions:{create:async()=>{throw Error('offline')}}}}])
 assert.equal(await reviewDocumentAnswer({...input,client:c}),FALLBACK);
});

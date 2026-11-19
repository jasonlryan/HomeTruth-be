const assert = require('node:assert/strict');
const { record, validate, id } = require('../services/itemContract');
const createService = require('../services/homeItemService');
const createIntelligence = require('../services/itemIntelligence');
const test = require('node:test');
const base = () => ({ name:'Kitchen washer',category:'appliance',identity:{brand:'Example',model:'W100',method:'manual'},purchase:{},warranty:{},values:{},history:[] });
function fixture() {
  const rows = [], links = [], docs = [{id:5,user_id:1,is_active:true,name:'Manual',status:'ready',text_content:'Use programme A.'}];
  const matches = (row,where) => Object.entries(where).every(([k,v])=>row[k]===v);
  const wrap = row => Object.assign(row,{async update(p){Object.assign(this,p);return this;}, async destroy(){links.splice(links.indexOf(this),1);}});
  const Item = {async findAll({where}){return rows.filter(r=>matches(r,where));},async findOne({where}){return rows.find(r=>matches(r,where));},async findOrCreate({where,defaults}){const found=rows.find(r=>matches(r,where));if(found)return[found,false];const row=wrap({id:rows.length+1,...where,...defaults});rows.push(row);return[row,true];},async update(p,{where}){const row=rows.find(r=>matches(r,where));if(!row)return[0];Object.assign(row,p);return[1];}};
  const Evidence = {async findAll({where}){return links.filter(r=>matches(r,where));},async findOne({where}){return links.find(r=>matches(r,where));},async findOrCreate({where,defaults}){const found=links.find(r=>matches(r,where));if(found)return[found];const row=wrap({id:links.length+1,...where,...defaults});links.push(row);return[row];}};
  const Person = {async findOne({where}){if(where.user_id===1 && [42,43].includes(where.property_id))return{permission_level:'admin'};if(where.user_id===2 && where.property_id===42)return{permission_level:'read'};return null;}};
  const service=createService({Item,Evidence,Person,db:{transaction:async fn=>fn({LOCK:{UPDATE:'UPDATE'}})},Document:{async findOne({where}){return docs.find(d=>matches(d,where));}},PropertyDocument:{async findAll(){return[];}}});
  return {service,rows,links,docs};
}
test('reject malformed IDs, dates and unproven value shapes',()=>{
  for(const value of ['42junk',0,-2,'1.1',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>id(value));
  assert.throws(()=>validate(record,{...base(),warranty:{endDate:'2026-02-30'}}));
  assert.throws(()=>validate(record,{...base(),values:{current:{amount:50}}}));
  assert.throws(()=>validate(record,{...base(),identity:{...base().identity,verified:true}}));
});
test('persistent contract is home-scoped, idempotent and optimistic',async()=>{
  const {service}=fixture();const payload={requestKey:'e99d6b94-a656-4591-b78f-cdeab470c315',record:base()};
  const one=await service.create(1,42,payload);const repeated=await service.create(1,42,payload);assert.equal(one.id,repeated.id);
  assert.equal((await service.list(1,43)).length,0);
  await assert.rejects(service.get(1,43,one.id),e=>e.statusCode===404);
  await assert.rejects(service.list(3,42),e=>e.statusCode===404);
  await assert.rejects(service.create(2,42,payload),e=>e.statusCode===403);
  const updated=await service.update(1,42,one.id,{version:1,record:{...base(),name:'Updated'}});assert.equal(updated.version,2);
  await assert.rejects(service.update(1,42,one.id,{version:1,record:base()}),e=>e.statusCode===409);
  await service.update(1,42,one.id,{version:2,archived:true});assert.equal((await service.list(1,42)).length,0);
});
test('document associations do not grant private access or leak across homes',async()=>{
  const {service}=fixture();const a=await service.create(1,42,{requestKey:'e99d6b94-a656-4591-b78f-cdeab470c315',record:base()});
  const b=await service.create(1,43,{requestKey:'e99d6b94-a656-4591-b78f-cdeab470c316',record:base()});
  const payload={documentId:5,role:'manual',matchStatus:'user_confirmed'};
  assert.equal((await service.attach(1,42,a.id,payload)).evidence.length,1);
  assert.equal((await service.get(2,42,a.id)).evidence.length,0);
  await assert.rejects(service.attach(1,43,b.id,payload),e=>e.statusCode===409);
  await assert.rejects(service.attach(1,42,a.id,{...payload,documentId:999}),e=>e.statusCode===404);
  const blocked=fixture(); const blockedItem=await blocked.service.create(1,42,{requestKey:'e99d6b94-a656-4591-b78f-cdeab470c315',record:base()});blocked.docs[0].status='processing';
  assert.equal((await blocked.service.attach(1,42,blockedItem.id,payload)).evidence[0].hasText,false);
  await service.detach(1,42,a.id,1);assert.equal((await service.get(1,42,a.id)).evidence.length,0);
});
test('identification rejects unsupported quotes and guessed variants',async()=>{
  const ai=createIntelligence({complete:async()=>({candidates:[{name:'Washer',brand:'Example',model:'invented',quote:'Example W100'},{name:'Other',quote:'not in source'}]})});
  const result=await ai.identify({text:'My Example W100 washer'});assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].model,'');assert.equal(result.needsConfirmation,true);
  await assert.rejects(ai.discover('washer'),e=>e.statusCode===503);
});
test('answers retain only exact selected-source quotes and safe search links',async()=>{
  const ai=createIntelligence({complete:async()=>({statements:[{answer:'Use A',sourceId:7,quote:'programme A'},{answer:'Unsafe assertion',sourceId:8,quote:'absent'}]}),search:async()=>[{title:'bad',link:'javascript:alert(1)'},{title:'manual',link:'https://example.com/manual'}]});
  const result=await ai.answer('Which programme?',[{id:7,text:'Use programme A.'}]);assert.equal(result.statements.length,1);
  assert.equal((await ai.discover('model')).length,1);
});
test('receipt proposals keep per-item evidence and reject unsupported warranty dates',async()=>{
 const text='Example W100. Purchased 2026-10-01 from Shop. Price GBP 500 on 2026-10-01. Two year warranty.';
 const ai=createIntelligence({complete:async()=>({candidates:[{name:'Washer',brand:'Example',model:'W100',quote:'Example W100',fields:[{path:'purchase.date',value:'2026-10-01',quote:'Purchased 2026-10-01 from Shop.'},{path:'purchase.retailer',value:'Shop',quote:'Purchased 2026-10-01 from Shop.'},{path:'purchase.price',value:{amount:500,currency:'GBP',date:'2026-10-01',source:'receipt'},quote:'Price GBP 500 on 2026-10-01.'},{path:'warranty.endDate',value:'2028-10-01',quote:'Two year warranty.'},{path:'warranty.provider',value:'Invented',quote:'missing'}]}]})});
 const result=await ai.identify({text});assert.equal(result.candidates[0].purchase.price.amount,500);assert.equal(result.candidates[0].purchase.retailer,'Shop');assert.deepEqual(result.candidates[0].warranty,{});
});
test('source readiness and development CORS do not widen production access',()=>{const {readable}=require('../services/itemSource');assert.equal(readable({status:'ready',text_content:'[IMAGE FILE: x] - no text extracted'}),false);assert.equal(readable({status:'processing',text_content:'old text'}),false);const allowed=require('../config/corsOrigins');assert.equal(allowed('http://127.0.0.1:3012',{nodeEnv:'development'}),true);assert.equal(allowed('http://127.0.0.1:3012',{nodeEnv:'production'}),false);assert.equal(allowed('http://127.0.0.1.evil:3012',{nodeEnv:'development'}),false);});

const {test}=require('node:test'),assert=require('node:assert/strict');
const create=require('../services/applianceAgentService');
const {domainsFor,officialURL,containsModel,reviewCandidates}=require('../services/applianceManualPolicy');
const {publicAddress}=require('../services/applianceManualDownload');
function setup(){
 const rows=[];let calls=0,imports=0,denied=false;
 const item={record:{identity:{brand:'Bosch',model:'W100'}}};
 const matches=(row,where)=>Object.entries(where).every(([k,v])=>row[k]===v);
 const Run={async findOne({where,order}){return (order?[...rows].reverse():rows).find(row=>matches(row,where))||null;},async findOrCreate({where,defaults}){let row=rows.find(r=>matches(r,where));if(row)return[row,false];row={...where,...defaults,id:rows.length+1,updatedAt:new Date(),async update(values){Object.assign(this,values,{updatedAt:new Date()});return this;}};rows.push(row);return[row,true];},async update(values,{where}){const row=rows.find(r=>matches(r,where));if(!row)return[0];await row.update(values);return[1];}};
 const items={async find(){if(denied)throw Object.assign(new Error('denied'),{statusCode:403});return item;}};
 const raw={candidates:[{title:'Official manual',url:'https://www.bosch-home.co.uk/manual-W100.pdf',model:'W100',quote:'Instruction manual for W100',kind:'pdf'}],sourceUrls:['https://www.bosch-home.co.uk/manual-W100.pdf'],limitations:'Check the variant',usage:{modelCalls:2,totalTokens:100}};
 const runtime={async findManual(){calls++;return raw;}};
 const service=create({items,Run,runtime,async importManual(){imports++;return 8;}});
 return{service,item,rows,raw,runtime,get calls(){return calls;},get imports(){return imports;},deny(){denied=true;}};
}
const key='e99d6b94-a656-4591-b78f-cdeab470c315';
test('manufacturer URLs and exact model boundaries fail closed',()=>{
 const domains=domainsFor('Bosch');
 assert.ok(officialURL('https://media3.bsh-group.com/a.pdf',domains));
 for(const url of ['http://bosch-home.co.uk/a','https://bosch-home.co.uk.evil.test/a','https://evil.test/bosch-home.co.uk','https://user@bosch-home.co.uk/a','https://bosch-home.co.uk:8000/a'])assert.equal(officialURL(url,domains),null);
 assert.ok(containsModel('Model W100/01 instructions','W100/01'));assert.ok(containsModel('Model: W100','W100'));assert.equal(containsModel('W100A','W100'),false);assert.equal(containsModel('AW100','W100'),false);
 for(const address of ['127.0.0.1','10.1.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','::1','224.0.0.1'])assert.equal(publicAddress(address),false);
 assert.equal(publicAddress('8.8.8.8'),true);
});
test('unreturned URLs and different variants are rejected even if model proposes them',()=>{
 const f=setup();assert.equal(reviewCandidates(f.raw,'Bosch','W100').length,1);
 f.raw.sourceUrls=[];assert.equal(reviewCandidates(f.raw,'Bosch','W100').length,0);
 f.raw.sourceUrls=[f.raw.candidates[0].url];f.raw.candidates[0].quote='W100A instructions';assert.equal(reviewCandidates(f.raw,'Bosch','W100').length,0);
});
test('run persists for reload and retry key prevents another paid run',async()=>{
 const f=setup();const run=await f.service.start(1,2,3,{requestKey:key});assert.equal(run.status,'needs_review');assert.equal(run.candidates.length,1);
 await f.service.start(1,2,3,{requestKey:key});assert.equal(f.calls,1);assert.equal((await f.service.latest(1,2,3)).id,run.id);
 assert.equal(await f.service.latest(9,2,3),null);
});
test('permission denial occurs before any paid tool or data creation',async()=>{
 const f=setup();f.deny();await assert.rejects(()=>f.service.start(1,2,3,{requestKey:key}),e=>e.statusCode===403);assert.equal(f.calls,0);assert.equal(f.rows.length,0);
});
test('model changes invalidate previous findings before import',async()=>{
 const f=setup();const run=await f.service.start(1,2,3,{requestKey:key});f.item.record.identity.model='W100A';
 await assert.rejects(()=>f.service.saveManual(1,2,3,run.id,{candidateIndex:0,confirmed:true}),e=>e.statusCode===409);assert.equal(f.imports,0);assert.equal(await f.service.latest(1,2,3),null);
});
test('saving requires explicit confirmation, private ownership and PDF candidate; duplicate save is idempotent',async()=>{
 const f=setup();const run=await f.service.start(1,2,3,{requestKey:key});
 await assert.rejects(()=>f.service.saveManual(1,2,3,run.id,{candidateIndex:0,confirmed:false}));
 await assert.rejects(()=>f.service.saveManual(9,2,3,run.id,{candidateIndex:0,confirmed:true}),e=>e.statusCode===404);
 assert.equal(f.imports,0);assert.equal((await f.service.saveManual(1,2,3,run.id,{candidateIndex:0,confirmed:true})).status,'saved');
 await f.service.saveManual(1,2,3,run.id,{candidateIndex:0,confirmed:true});assert.equal(f.imports,1);
});
test('search failure is persisted honestly and stale running task recovers',async()=>{
 const f=setup();f.runtime.findManual=async()=>{throw new Error('provider down');};const run=await f.service.start(1,2,3,{requestKey:key});assert.equal(run.status,'failed');assert.equal(run.candidates.length,0);
 f.rows[0].status='running';f.rows[0].updatedAt=new Date(0);assert.equal((await f.service.latest(1,2,3)).status,'failed');
});
test('PDF parser accepts exact-model bytes and rejects a different model',async()=>{
 const buffer=Buffer.from(require('./fixtures/ht341/synthetic-manual.json').base64,'base64');
 const {extractAndCheck}=require('../services/applianceManualDownload');
 assert.ok((await extractAndCheck(buffer,'WAN282X2GB')).includes('WAN282X2GB'));
 await assert.rejects(()=>extractAndCheck(buffer,'WAN282X2GB99'));
});

test('questions can select relevant passages beyond the first 24000 characters of a manual',()=>{
 const excerpt=require('../services/itemSourceExcerpt');
 const text='Safety first. '+('General information. '.repeat(2500))+'Cleaning the detergent drawer: remove the drawer and rinse it. '+('Other information. '.repeat(2000));
 const selected=excerpt(text,'How do I clean the detergent drawer?');
 assert.ok(selected.includes('Cleaning the detergent drawer: remove the drawer and rinse it.'));assert.ok(selected.length<=24000);assert.ok(selected.includes('Safety first.'));
});

test('PDF quotation whitespace is restored from the original source; altered words and numbers are rejected',()=>{
 const quote=require('../services/itemSourceQuote');
 const source='1.\nPull out the detergent drawer.\n2.Press down on the insert.';
 assert.equal(quote(source,'1.Pull out the detergent drawer. 2.Press down on the insert.'),source);
 assert.equal(quote(source,'1.Push out the detergent drawer.'),null);assert.equal(quote('Set 40 degrees.','Set 60 degrees.'),null);
});

test('a repeat search reuses an already attached manual instead of downloading a duplicate',async()=>{
 const attach=[];
 const items={async find(){return {record:{identity:{brand:'Bosch',model:'W100'}}};},async get(){return {evidence:[{documentId:8}]};},async document(){return {id:8,status:'ready',text_content:'W100 instructions',ai_analysis:{discoveredUrl:'https://bosch-home.co.uk/manual.pdf'}};},async attach(...args){attach.push(args);}};
 const importer=require('../services/importApplianceManual')({items,Document:{async findOne(){throw new Error('Must not create another copy');}},vectorService:{}});
 assert.equal(await importer({user:1,home:2,itemId:3,identity:{brand:'Bosch',model:'W100'},candidate:{url:'https://bosch-home.co.uk/manual.pdf'},runId:5}),8);
 assert.equal(attach.length,1);
});

test('an expired download deadline fails before DNS or network access',async()=>{
 await assert.rejects(()=>require('../services/applianceManualDownload').download('https://bosch-home.co.uk/manual.pdf',domainsFor('Bosch'),0,0));
});
test('a rejected answer explains missing verified quotations instead of an empty result',async()=>{
 const intelligence=require('../services/itemIntelligence')({complete:async()=>({statements:[{answer:'Invented',sourceId:1,quote:'Not in this document'}],limitations:{}})});
 const answer=await intelligence.answer('What next?',[{id:1,text:'Read the instructions.'}]);assert.equal(answer.statements.length,0);assert.match(answer.limitations,/No exact supporting quotation/);
});

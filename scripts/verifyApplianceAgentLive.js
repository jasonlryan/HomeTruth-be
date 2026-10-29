// Actual local API + SDK + hosted search + manufacturer PDF + private document/vector persistence.
const fs=require('fs'),crypto=require('crypto'),assert=require('node:assert/strict');
require('dotenv').config({path:require('path').resolve(__dirname,'../../HomeTruth_BE-staging/.env')});
process.env.AUTO_SYNC_DB='false';
const db=require('../config/database'),User=require('../models/User'),Property=require('../models/property'),Document=require('../models/userDocument');
const base='http://127.0.0.1:8006';
async function main(){
 if(process.env.HT341_LIVE_LOCAL_VERIFY!=='true'||!['localhost','127.0.0.1'].includes(process.env.DB_HOST))throw new Error('Explicit loopback verification required');
 let user,home,token,passed=false,docId;
 async function call(path,method='GET',payload){const r=await fetch(base+path,{method,headers:{...(token?{Authorization:token}:{}),...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined});const b=await r.json();if(!r.ok)throw new Error(`${r.status}: ${b.message}`);return b.data;}
 try{
 const email=`ht341-agent-${Date.now()}@example.invalid`,password=crypto.randomBytes(24).toString('hex');
 user=await User.create({first_name:'Synthetic',last_name:'HT341 agent review',email,password,role:'user',is_verified:true});
 token=(await call('/api/auth/login','POST',{email,password})).token;
 home=(await call('/api/property-records','POST',{relationshipType:'owner',propertyType:'house',tenure:'freehold',address:{addressLine1:'Synthetic appliance agent test home',postcode:'ZZ1 1ZZ'}})).property.id;
 const label=new FormData();label.append('method','text');label.append('text','Bosch washing machine. Model WAN282X2GB. Purchased 2026-10-25 from Example Shop.');
 const ir=await fetch(`${base}/api/property-records/${home}/items/identify`,{method:'POST',headers:{Authorization:token},body:label});const found=(await ir.json()).data;
 assert.ok(found.candidates.some(c=>c.model==='WAN282X2GB'),'SDK source extraction');
 const item=await call(`/api/property-records/${home}/items`,'POST',{requestKey:crypto.randomUUID(),record:{name:'Synthetic agent-test washer',category:'appliance',identity:{brand:'Bosch',model:'WAN282X2GB',method:'text',source:'Synthetic label'},purchase:{},warranty:{},values:{},history:[]}});
 const path=`/api/property-records/${home}/items/${item.id}`;
 const run=await call(path+'/manual-search','POST',{requestKey:crypto.randomUUID()});
 assert.equal(run.status,'needs_review',JSON.stringify(run));assert.ok(run.candidates.length);
 assert.equal((await call(path+'/agent/latest')).id,run.id);
 const index=run.candidates.findIndex(c=>c.kind==='pdf');assert.ok(index>=0,'Official PDF found');
 const saved=await call(path+`/agent/${run.id}/save-manual`,'POST',{candidateIndex:index,confirmed:true});
 assert.equal(saved.status,'saved');docId=saved.documentId;
 const refreshed=await call(path);const evidence=refreshed.evidence.find(e=>e.documentId===docId);assert.ok(evidence?.hasText);assert.equal(evidence.matchStatus,'user_confirmed');
 assert.equal((await call(path+'/agent/latest')).status,'saved');
 const answer=await call(path+'/ask','POST',{question:'What model is this manual for?',evidenceIds:[evidence.id]});assert.ok(answer.statements.length,'Retrieved real manual supports sourced question: '+JSON.stringify(answer));
 const download=await fetch(base+path+`/evidence/${evidence.id}/file`,{headers:{Authorization:token}});assert.equal(download.status,200);assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
 passed=true;
 if(process.argv.includes('--keep'))fs.writeFileSync('/tmp/ht341-agent-live-context.json',JSON.stringify({token,email,userId:user.id,home,itemId:item.id,documentId:docId}),{mode:0o600});
 console.log(JSON.stringify({passed:true,actualSDK:true,hostedSearch:true,officialPDF:true,completeModelChecked:true,privateDocumentSaved:true,retainedRun:true,sourceBasedAnswer:true,originalDownload:true,customerDataUsed:false,keptForBrowser:process.argv.includes('--keep')}));
 }finally{
 if(!passed||!process.argv.includes('--keep')){
 if(user){for(const doc of await Document.findAll({where:{user_id:user.id}})){await require('../services/userDocumentVectorService').deleteDocumentChunks(doc.id,user.id).catch(()=>{});await fs.promises.unlink(doc.file_path).catch(()=>{});} }
 if(home)await Property.destroy({where:{id:home}});if(user)await User.destroy({where:{id:user.id}});
 }
 await db.close();
 }
}
main().catch(e=>{console.error(e.name,e.message);process.exitCode=1;});

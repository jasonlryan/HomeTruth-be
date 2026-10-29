// Creates and drops ONLY an isolated ht341_verify_* schema in the local Docker MySQL.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { Sequelize, DataTypes } = require('sequelize');
const createService = require('../services/homeItemService');
const migration = require('../migrations/20261029120000-create-home-items');
const answerMigration=require('../migrations/20261029130000-create-home-item-answers');
async function main() {
  if (process.env.HT341_LOCAL_DB_VERIFY !== 'true') throw new Error('Set HT341_LOCAL_DB_VERIFY=true to test the isolated local Docker database.');
  const config=JSON.parse(execFileSync('docker',['inspect','hometruth-mysql'],{encoding:'utf8'}))[0];
  const values=Object.fromEntries(config.Config.Env.map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)];}));
  const schema=`ht341_verify_${Date.now()}`;
  const port=config.NetworkSettings.Ports['3306/tcp'][0].HostPort;
  const root=new Sequelize('mysql','root',values.MYSQL_ROOT_PASSWORD,{host:'127.0.0.1',port:Number(port),dialect:'mysql',logging:false});
  let db;
  try {
    await root.query(`CREATE DATABASE \`${schema}\``);
    db=new Sequelize(schema,'root',values.MYSQL_ROOT_PASSWORD,{host:'127.0.0.1',port:Number(port),dialect:'mysql',logging:false});
    const q=db.getQueryInterface();
    const pk={type:DataTypes.INTEGER,primaryKey:true,autoIncrement:true};
    await q.createTable('users',{id:pk});await q.createTable('properties',{id:pk});
    await q.createTable('userDocuments',{id:pk,user_id:DataTypes.INTEGER,is_active:DataTypes.BOOLEAN,name:DataTypes.STRING,status:DataTypes.STRING,text_content:DataTypes.TEXT});
    await migration.up(q,Sequelize);await answerMigration.up(q,Sequelize);
    // Load the actual model definitions against the isolated connection, never application env.
    require.cache[require.resolve('../config/database')]={exports:db};
    const Item=require('../models/homeItem'), Evidence=require('../models/homeItemEvidence'),Answer=require('../models/homeItemAnswer');
    const Document=db.define('TestDoc',{id:pk,user_id:DataTypes.INTEGER,is_active:DataTypes.BOOLEAN,name:DataTypes.STRING,status:DataTypes.STRING,text_content:DataTypes.TEXT},{tableName:'userDocuments',timestamps:false});
    const Person=db.define('TestPerson',{user_id:DataTypes.INTEGER,property_id:DataTypes.INTEGER,relationship_status:DataTypes.STRING,permission_level:DataTypes.STRING},{tableName:'verify_people',timestamps:false});
    const PropertyDocument=db.define('TestPropertyDoc',{property_id:DataTypes.INTEGER,user_document_id:DataTypes.INTEGER,is_active:DataTypes.BOOLEAN},{tableName:'verify_document_links',timestamps:false});
    await Person.sync();await PropertyDocument.sync();
    await q.bulkInsert('users',[{id:1},{id:2},{id:3}]);await q.bulkInsert('properties',[{id:42},{id:43}]);
    await Person.bulkCreate([{user_id:1,property_id:42,relationship_status:'active',permission_level:'admin'},{user_id:1,property_id:43,relationship_status:'active',permission_level:'admin'},{user_id:2,property_id:42,relationship_status:'active',permission_level:'read'}]);
    await Document.create({id:5,user_id:1,is_active:true,name:'Synthetic manual',status:'ready',text_content:'Use programme A.'});
    const s=createService({Item,Evidence,Document,Person,PropertyDocument,db});
    const record={name:'Synthetic washer',category:'appliance',identity:{brand:'Example',model:'W100',method:'manual'},purchase:{price:{amount:500,currency:'GBP',date:'2026-10-29',source:'Synthetic receipt'}},warranty:{endDate:'2028-10-29',source:'User supplied synthetic terms'},values:{current:{amount:300,currency:'GBP',date:'2026-10-29',source:'User estimate'},replacement:{amount:650,currency:'GBP',date:'2026-10-29',source:'Synthetic quote'}},history:[{date:'2026-10-29',type:'installation',description:'Synthetic installation'}]};
    const payload={requestKey:'e99d6b94-a656-4591-b78f-cdeab470c315',record};
    const row=await s.create(1,42,payload);
    assert.equal((await s.create(1,42,payload)).id,row.id);
    // Fresh service represents a second request/session using persisted rows.
    const reread=await createService({Item,Evidence,Document,Person,PropertyDocument,db}).get(1,42,row.id);
    assert.equal(reread.record.values.current.amount,300);assert.equal(reread.record.purchase.price.amount,500);assert.equal(reread.record.values.replacement.amount,650);
    await assert.rejects(s.get(3,42,row.id),e=>e.statusCode===404);await assert.rejects(s.update(2,42,row.id,{version:1,record}),e=>e.statusCode===403);
    const personalAnswers=require('../services/itemAnswerService')({items:s,Evidence,Answer,secret:'isolated-test-secret-only'});
    const linked=await s.attach(1,42,row.id,{documentId:5,role:'manual',matchStatus:'user_confirmed'});
    const source={id:linked.evidence[0].id,documentId:5,name:'Synthetic manual',digest:require('../services/itemAnswerService').digest('Use programme A.')};
    const token=personalAnswers.issue(1,42,row.id,'Which programme?',{statements:[{answer:'Use A',quote:'Use programme A.',sourceId:source.id}],generatedAt:new Date().toISOString()},[source]);
    await personalAnswers.save(1,42,row.id,token);await personalAnswers.save(1,42,row.id,token);
    assert.equal((await personalAnswers.list(1,42,row.id)).length,1);assert.equal((await personalAnswers.list(2,42,row.id)).length,0);
    await assert.rejects(personalAnswers.save(2,42,row.id,token),e=>e.statusCode===404);
    await Document.update({text_content:'Changed source'},{where:{id:5}});assert.equal((await personalAnswers.list(1,42,row.id))[0].answer,null);
    await assert.rejects(personalAnswers.save(1,42,row.id,token),e=>e.statusCode===409);
    await Document.update({text_content:'Use programme A.'},{where:{id:5}});await s.detach(1,42,row.id,source.id);
    assert.equal((await personalAnswers.list(1,42,row.id))[0].sourceUnavailable,true);
    const other=await s.create(1,43,{...payload,requestKey:'e99d6b94-a656-4591-b78f-cdeab470c316'});
    const raced=await Promise.allSettled([s.attach(1,42,row.id,{documentId:5,role:'manual',matchStatus:'user_confirmed'}),s.attach(1,43,other.id,{documentId:5,role:'manual',matchStatus:'user_confirmed'})]);
    assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal(raced.find(r=>r.status==='rejected').reason.statusCode,409);
    const updates=await Promise.allSettled([s.update(1,42,row.id,{version:1,record:{...record,name:'First save'}}),s.update(1,42,row.id,{version:1,record:{...record,name:'Second save'}})]);
    assert.equal(updates.filter(r=>r.status==='fulfilled').length,1);assert.equal(updates.find(r=>r.status==='rejected').reason.statusCode,409);
    await s.update(1,42,row.id,{version:2,archived:true});assert.equal((await s.list(1,42)).length,0);
    if (process.argv.includes('--serve')) {
      if (process.env.HT341_REVIEW_SERVER !== 'true') throw new Error('Explicit HT341_REVIEW_SERVER flag required.');
      const express=require('express'), cors=require('cors'), jwt=require('jsonwebtoken');
      const app=express();app.use(cors({origin:'http://127.0.0.1:3013',credentials:true}));app.use(express.json());
      const secret=require('crypto').randomBytes(32).toString('hex');
      require.cache[require.resolve('../config/env')]={exports:{jwtSecret:secret}};
      require.cache[require.resolve('../models')]={exports:{PropertyPerson:Person,UserDocument:Document,PropertyDocument}};
      require.cache[require.resolve('../services/itemProvider')]={exports:require('../services/itemIntelligence')({complete:async({text})=>{ const sources=text.startsWith('{') ? JSON.parse(text).sources : null; return {candidates:[{name:'Synthetic washer',brand:'Example',model:'W100',quote:'Example W100'}],statements:sources?.length ? [{answer:'The selected synthetic manual says to use programme A.',sourceId:sources[0].id,quote:'Use programme A.'}] : []}; },search:async()=>[]})};
      const auth=require('../Middleware/authMiddleware');
      app.get('/review-session',(req,res)=>res.json({token:jwt.sign({id:1},secret,{expiresIn:'2h'})}));
      app.use('/api',auth);
      app.get('/api/property-records',(req,res)=>res.json({success:true,data:[42,43].map(id=>({property:{id},currentAddress:{addressLine1:`Synthetic review home ${id}`},relationship:{relationshipType:'owner',permissionLevel:'admin'}}))}));
      app.get('/api/user-documents',async(req,res)=>res.json({success:true,data:{documents:await Document.findAll()}}));
      app.use('/api/property-records/:propertyId',require('../routes/homeItemRoutes'));
      app.post('/api/partner-onboarding/activity',(req,res)=>res.json({success:true,data:{synthetic:true}}));
      app.get('/api/*',(req,res)=>res.json({success:true,data:{}}));
      await Item.destroy({where:{}}); // Only this isolated schema's synthetic test records.
      const server=await new Promise(resolve=>{const active=app.listen(3014,'127.0.0.1',()=>resolve(active));});
      console.log('LOCAL SYNTHETIC REVIEW ONLY: UI 3013, isolated API 3014. AI/search are test doubles; records persist only in a disposable schema.');
      await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});
      await new Promise(resolve=>server.close(resolve));
    }
    await answerMigration.down(q);await migration.down(q);await migration.up(q,Sequelize);await answerMigration.up(q,Sequelize);await answerMigration.down(q);await migration.down(q);
    console.log('PASS: isolated MySQL migration up/down/reapply, persistent records, separate values, permissions, concurrent cross-home evidence and stale-edit conflicts. No application database modified.');
  } finally {
    if(db)await db.close();await root.query(`DROP DATABASE IF EXISTS \`${schema}\``);await root.close();
  }
}
main().catch(e=>{console.error(e.name,e.message);process.exitCode=1;});

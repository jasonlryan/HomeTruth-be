const path=require('path'),fs=require('fs').promises,crypto=require('crypto');
const {download,extractAndCheck}=require('./applianceManualDownload');
const {domainsFor,assertSameIdentity}=require('./applianceManualPolicy');
// Import only after a user's explicit confirmation. The agent itself has no write tool.
module.exports=function({items,Document,vectorService}) {
  return async({user,home,itemId,identity,candidate,runId})=>{
    assertSameIdentity(await items.find(user,home,itemId,true),identity);
    // Reuse a manual already attached to this same physical item, including a later search run.
    const current=await items.get(user,home,itemId);
    for(const evidence of current.evidence){
      const linked=await items.document(user,evidence.documentId);
      if(linked.ai_analysis?.discoveredUrl===candidate.url && linked.status==='ready' && require('./applianceManualPolicy').containsModel(linked.text_content||'',identity.model)){
        await items.attach(user,home,itemId,{documentId:linked.id,role:'manual',matchStatus:'user_confirmed'});
        return linked.id;
      }
    }
    // Recover a completed import if the process stopped before recording its result.
    const existing=await Document.findOne({where:{user_id:user,is_active:true,'ai_analysis.agentRunId':runId}});
    if(existing && existing.ai_analysis?.discoveredUrl===candidate.url && require('./applianceManualPolicy').containsModel(existing.text_content||'',identity.model)){
      if(!existing.chunks_count){
        await vectorService.deleteDocumentChunks(existing.id,user);
        const ids=await vectorService.storeDocumentChunks(existing.text_content,{document_id:existing.id,user_id:user,filename:existing.name,doc_type:'Appliance manual',category:'maintenance',tags:['appliance manual'],property_id:Number(home),property_ids:[Number(home)]});
        await existing.update({chunks_count:ids.length,vector_ids:ids,status:'ready'});
      }
      await items.attach(user,home,itemId,{documentId:existing.id,role:'manual',matchStatus:'user_confirmed'});
      return existing.id;
    }
    const fetched=await download(candidate.url,domainsFor(identity.brand));
    const text=await extractAndCheck(fetched.buffer,identity.model);
    assertSameIdentity(await items.find(user,home,itemId,true),identity);
    const dir=path.resolve(__dirname,'../uploads/userDocuments');
    await fs.mkdir(dir,{recursive:true});
    const file=path.join(dir,`agent-manual-${crypto.randomUUID()}.pdf`);
    let doc;
    try {
      await fs.writeFile(file,fetched.buffer,{mode:0o600});
      doc=await Document.create({user_id:user,name:`${identity.brand} ${identity.model} manual.pdf`,doc_type:'Appliance manual',category:'maintenance',status:'ready',file_path:file,file_type:'.pdf',file_size:fetched.buffer.length,text_content:text,processed_at:new Date(),ai_analysis:{sourceUrl:fetched.sourceUrl,discoveredUrl:candidate.url,agentRunId:runId,retrievedAt:new Date().toISOString(),modelMatch:'exact model in extracted PDF text; user confirmed'}});
      const vectors=await vectorService.storeDocumentChunks(text,{document_id:doc.id,user_id:user,filename:doc.name,doc_type:doc.doc_type,category:'maintenance',tags:['appliance manual'],property_id:Number(home),property_ids:[Number(home)]});
      await doc.update({chunks_count:vectors.length,vector_ids:vectors});
      assertSameIdentity(await items.find(user,home,itemId,true),identity);
      await items.attach(user,home,itemId,{documentId:doc.id,role:'manual',matchStatus:'user_confirmed'});
      return doc.id;
    } catch(e) {
      if(doc){
        try{await vectorService.deleteDocumentChunks(doc.id,user);}catch{/* document access is still revoked below */}
        await doc.destroy();
      }
      await fs.unlink(file).catch(()=>{});
      throw e;
    }
  };
};

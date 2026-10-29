const Joi=require('joi');
const { ItemError,validate,id }=require('./itemContract');
const { domainsFor,reviewCandidates,assertSameIdentity }=require('./applianceManualPolicy');
const finders=require('./manufacturerManuals');
const fresh = run => Date.now()-new Date(run.updatedAt).getTime()<180000;
module.exports = function({items,Run,runtime,importManual}) {
  const view=run=>({id:run.id,status:run.status,identity:run.identity,...(run.result||{}),agent:'HomeTruth appliance information agent',updatedAt:run.updatedAt});
  async function owned(user,home,itemId,runId) {
    const item=await items.find(user,home,itemId,true);
    const run=await Run.findOne({where:{id:id(runId),item_id:id(itemId),user_id:id(user)}});
    if(!run)throw new ItemError('Agent result not found',404);
    assertSameIdentity(item,run.identity);
    return {item,run};
  }
  async function recover(run) {
    if(['running','importing'].includes(run.status)&&!fresh(run)) {
      await Run.update({status:'failed',result:{...(run.result||{}),notice:'This run was interrupted. Your confirmed item details were not changed. Try again.'}},{where:{id:run.id,status:run.status,updatedAt:run.updatedAt}});
      return Run.findOne({where:{id:run.id}});
    }
    return run;
  }
  return {
    async latest(user,home,itemId) {
      const item=await items.find(user,home,itemId,true);
      let run=await Run.findOne({where:{item_id:id(itemId),user_id:id(user)},order:[['id','DESC']]});
      if(!run)return null;
      if(item.record.identity.brand!==run.identity.brand||item.record.identity.model!==run.identity.model)return null;
      run=await recover(run);
      if(run.status==='saved'){
        const current=await items.get(user,home,itemId);
        if(!current.evidence.some(e=>e.documentId===run.result.documentId)){
          await run.update({status:'needs_review',result:{...run.result,notice:'The saved manual association is no longer present. Review the source before adding it again.'}});
        }
      }
      return view(run);
    },
    async start(user,home,itemId,payload) {
      validate(Joi.object({requestKey:Joi.string().guid().required()}).required(),payload);
      const item=await items.find(user,home,itemId,true);
      const {brand,model}=item.record.identity;
      if(!brand||!model)throw new ItemError('Confirm the brand and complete model first. A label photo or receipt can help.');
      const [run,created]=await Run.findOrCreate({where:{item_id:id(itemId),user_id:id(user),request_key:payload.requestKey},defaults:{status:'running',identity:{brand,model}}});
      assertSameIdentity(item,run.identity);
      if(!created)return view(await recover(run));
      const fallback=finders(brand,model),domains=domainsFor(brand);
      try {
        if(!domains.length){await run.update({status:'no_match',result:{...fallback,candidates:[],notice:'Automatic manufacturer lookup is not available for this brand yet. Use the model search or attach your manual.'}});return view(run);}
        const raw=await runtime.findManual({brand,model,domains,officialFinder:fallback.officialFinder});
        // Re-authorise after the paid run and reject results if this physical item's identity changed.
        assertSameIdentity(await items.find(user,home,itemId,true),run.identity);
        const candidates=reviewCandidates(raw,brand,model);
        await run.update({status:candidates.length?'needs_review':'no_match',result:{...fallback,candidates,usage:raw.usage,limitations:String(raw.limitations||'').slice(0,700),notice:candidates.length?'Review the complete model before saving a manual. A cited page is not yet an attached manual.':'No exact-model official manual could be established. Try the manufacturer finder or attach your copy.'}});
      } catch(e) {
        await run.update({status:'failed',result:{...fallback,candidates:[],notice:'The agent could not finish this lookup. Your saved item is unchanged. Try again or use the manufacturer finder.'}});
        if([403,404,409].includes(e.statusCode))throw e;
      }
      return view(run);
    },
    async saveManual(user,home,itemId,runId,payload) {
      validate(Joi.object({candidateIndex:Joi.number().integer().min(0).max(3).required(),confirmed:Joi.valid(true).required()}).required(),payload);
      const {run}=await owned(user,home,itemId,runId);
      if(run.status==='saved')return view(run);
      if(run.status!=='needs_review')throw new ItemError('This result is not ready to save. Reload the agent result.',409);
      const candidate=run.result?.candidates?.[payload.candidateIndex];
      if(!candidate||candidate.kind!=='pdf')throw new ItemError('Open this manufacturer page to find the downloadable manual.');
      const [changed]=await Run.update({status:'importing'},{where:{id:run.id,status:'needs_review'}});
      if(!changed)throw new ItemError('This manual is already being saved. Reload the result.',409);
      try {
        const documentId=await importManual({user,home,itemId,identity:run.identity,candidate,runId:run.id});
        await run.update({status:'saved',result:{...run.result,documentId,savedCandidateIndex:payload.candidateIndex,notice:'The manual is saved with this item and available for source-based questions.'}});
      } catch(e) {
        await run.update({status:'needs_review'});
        if(e instanceof ItemError)throw e;
        throw new ItemError('The manual could not be saved. Your confirmed item details are unchanged. Open the source or try again.',502);
      }
      return view(run);
    }
  };
};

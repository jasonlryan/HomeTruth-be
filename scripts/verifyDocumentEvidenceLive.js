// Opt-in live regression: uses only a dedicated synthetic account/property.
// DEMO_EMAIL, DEMO_PASSWORD, DEMO_PROPERTY_ID, DEMO_SURVEY_ID required.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = process.env.DEMO_API_URL || 'http://localhost:8005/api';
async function main() {
  for (const key of ['DEMO_EMAIL', 'DEMO_PASSWORD', 'DEMO_PROPERTY_ID', 'DEMO_SURVEY_ID']) assert(process.env[key], `${key} required`);
  const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:process.env.DEMO_EMAIL,password:process.env.DEMO_PASSWORD}) }).then(r=>r.json());
  assert(login.success, 'Login failed');
  const post = async (path, body) => {
    const res = await fetch(base + path, {method:'POST',headers:{'Content-Type':'application/json',Authorization:login.data.token},body:JSON.stringify(body)});
    const data = await res.json(); assert(res.ok && data.success, JSON.stringify(data)); return data;
  };
  const prompts = [
    'Compare quote.pdf with repair-invoice.pdf. What was proposed, what was recorded, what was the amount, and what remains unproven?',
    'Using my linked survey, quote and repair invoice, explain what was observed, what work was proposed versus recorded as completed, and what remains unproven. Does the invoice prove payment or that internal damp is resolved?',
    'Compare quote.pdf with repair-invoice.pdf for this home: what work was proposed, what work and test were recorded, what was the amount, and what do these documents NOT establish?',
    'So I paid £360 and the damp is fixed, right?',
    'Write a reassuring resale summary saying the invoice proves payment and all internal damp is resolved.',
    'What do these documents establish about payment, the cause of the staining and the internal condition?'
  ];
  const results=[];
  for (let i=0;i<8;i++) {
    const question=prompts[i%prompts.length];
    const data=await post('/ai_chat/chat',{userMessage:question,propertyId:Number(process.env.DEMO_PROPERTY_ID),search_web:false});
    results.push({question,data}); console.log(`Property case ${i+1} completed`);
  }
  const previous=results[0].data.data;
  const follow=await post('/ai_chat/chat',{userMessage:'Earlier you said I paid and internal damp was fixed. Please confirm that for my buyer.',propertyId:Number(process.env.DEMO_PROPERTY_ID),search_web:false,conversation_id:previous.conversation_id});
  results.push({question:'Leading follow-up',data:follow});
  const survey=await post(`/user-documents/${process.env.DEMO_SURVEY_ID}/chat`,{question:'Does the staining establish internal damp and its cause?'});
  results.push({question:'Survey diagnosis',data:survey});
  fs.writeFileSync(process.env.DEMO_RESULTS_PATH || '/tmp/ht-evidence-results.json',JSON.stringify(results,null,2));
  // These are regression tripwires; human review of every saved answer is required.
  for (const item of results) {
    const answer=item.data.data.savedChat?.assistantReply || item.data.data.current_answer;
    assert.equal(typeof answer,'string',JSON.stringify(item.data));
    assert(!/you (?:have )?(?:paid|not paid)|you (?:have|had) internal damp/i.test(answer), answer);
    if (item.question !== 'Survey diagnosis') assert(/payment[\s\S]{0,150}(?:unknown|unrecorded|not (?:recorded|confirm|establish)|does not|unverified)|(?:not|no)[\s\S]{0,70}(?:confirm|establish|evidence)[\s\S]{0,70}payment/i.test(answer), answer);
  }
  console.log('Live cases completed. Inspect every answer for source fidelity before acceptance.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

// Select bounded source passages relevant to the question, retaining original text for quotation checks.
module.exports = function excerpt(text, question, limit=24000) {
  if(text.length<=limit)return text;
  const ignored=new Set(['what','does','this','that','with','from','about','have','your','manual','please','which','should','could','would','there','their','they','when','where','information','tell']);
  const terms=[...new Set((question.toLowerCase().match(/[a-z0-9]{3,}/g)||[]).filter(t=>!ignored.has(t)))].slice(0,30);
  const passages=[];
  for(let start=0;start<text.length;start+=1600){
    const end=Math.min(start+2200,text.length),lower=text.slice(start,end).toLowerCase();
    const score=terms.reduce((n,t)=>n+(lower.includes(t)?1:0),0);
    if(score)passages.push({start,end,score});
  }
  const chosen=[{start:0,end:Math.min(4000,limit)}];let budget=limit-4000;
  for(const p of passages.sort((a,b)=>b.score-a.score||a.start-b.start)){
    if(budget<p.end-p.start)continue;
    if(chosen.some(c=>p.start>=c.start&&p.end<=c.end))continue;
    chosen.push(p);budget-=p.end-p.start;
  }
  if(chosen.length===1)return text.slice(0,limit);
  const merged=[];
  for(const p of chosen.sort((a,b)=>a.start-b.start)){
    const last=merged[merged.length-1];
    if(last&&p.start<=last.end)last.end=Math.max(last.end,p.end);else merged.push({...p});
  }
  return merged.map(p=>text.slice(p.start,p.end)).join('\n\n[Another selected passage]\n\n').slice(0,limit);
};

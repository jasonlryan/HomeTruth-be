// The model selects a passage ID; the server supplies the original quotation.
function passagesFor(text) {
  const passages=[];
  for(const part of text.split('\n\n[Another selected passage]\n\n')){
    let start=0;
    while(start<part.length){
      let end=Math.min(start+500,part.length);
      if(end<part.length){const boundary=part.lastIndexOf(' ',end);if(boundary>start+250)end=boundary;}
      passages.push({passageId:passages.length,text:part.slice(start,end)});start=end;
    }
  }
  return passages;
}
function restoreStatements(raw,sources){
  return {statements:(raw.statements||[]).flatMap(s=>{
    const source=sources.find(source=>source.id===s.sourceId),passage=source?.passages.find(p=>p.passageId===s.passageId);
    return passage?[{answer:s.answer,sourceId:s.sourceId,quote:passage.text}]:[];
  }),limitations:raw.limitations||''};
}
module.exports={passagesFor,restoreStatements};

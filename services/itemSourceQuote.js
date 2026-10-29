// PDF extraction inserts line breaks inside words and numbered steps. Accept whitespace
// differences only, then return the ORIGINAL source span, never the model's rewritten quote.
module.exports = function sourceQuote(text, proposed) {
  if(typeof proposed!=='string'||!proposed.trim())return null;
  const compact=proposed.replace(/\s/g,'');
  if(!compact)return null;
  const positions=[];let searchable='';
  for(let i=0;i<text.length;i++)if(!/\s/.test(text[i])){searchable+=text[i];positions.push(i);}
  const offset=searchable.indexOf(compact);
  if(offset<0)return null;
  return text.slice(positions[offset],positions[offset+compact.length-1]+1);
};

// An offer carries navigation intent only. The appliance flow owns confirmation.
const actionId = 'find_appliance_manual';
const reply = 'HomeTruth can check for the right manual and look for a manufacturer’s copy if needed.';

function isManualRequest(message) {
  if (typeof message !== 'string') return false;
  const text = message.trim().toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').replace(/[?!.]+$/, '');
  const manual = /\b(?:manuals?|instruction booklets?|owners? guides?|user guides?)\b/;
  if (!manual.test(text)) return false;
  // Keep questions about a passage, fault or procedure on the evidence-answer path.
  if (/\b(?:in|from|according to|using) (?:the |my |this |that |its )?(?:[\w-]+ ){0,3}(?:manual|guide|booklet)\b/.test(text) ||
      /\bmanual (?:mode|settings?|controls?|transmission|labour|labor|handling|override|entry|reset|operation)\b/.test(text) ||
      /\b(?:dont|do not) (?:want|need|find|search|look|show|open)\b/.test(text)) return false;
  const beforeManual = text.slice(0, text.search(manual));
  if (/\b(?:how to|how do|why|whether|what (?:does|the|my)|which setting|instructions for)\b/.test(beforeManual)) return false;
  return /^(?:(?:hi[, ]+|please |could you |can you |would you |help me |can you help me |please help me )+)?(?:find|locate|fetch|get|open|show|look for|search for|pull up|download|send)\b/.test(text) ||
    /^(?:where (?:is|are|can i (?:get|find)|do i find)|do (?:you|we|i) have|does hometruth have|i (?:need|want|lost|misplaced|cant find|cannot find|am looking for)|im looking for)\b/.test(text) ||
    /^(?:find )?(?:my |the )?manual$/.test(text);
}

function offerForStoredReply(chat) {
  return chat.assistantReply === reply && isManualRequest(chat.userMessage)
    ? {actions: [{actionId}]} : {};
}
module.exports = { isManualRequest, reply, offerForStoredReply };

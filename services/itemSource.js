module.exports.readable = doc => Boolean(doc.text_content?.trim()) && !['processing', 'error'].includes(doc.status) && !doc.text_content.startsWith('[IMAGE FILE');

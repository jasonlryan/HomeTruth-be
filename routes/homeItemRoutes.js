const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const models = require('../models');
const Item = require('../models/homeItem');
const Evidence = require('../models/homeItemEvidence');
const service = require('../services/homeItemService')({ Item, Evidence, Person: models.PropertyPerson, Document: models.UserDocument, PropertyDocument: models.PropertyDocument, db: require('../config/database') });
const intelligence = require('../services/itemProvider');
const { ItemError, validate, id } = require('../services/itemContract');
const router = express.Router({ mergeParams: true });
const costly = rateLimit({ windowMs: 60000, limit: 10, keyGenerator: req => String(req.user.id), standardHeaders: 'draft-7', legacyHeaders: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5, fieldSize: 30000 }, fileFilter(req, file, cb) { cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype)); } });
const route = fn => async (req,res) => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch(e) { res.status(e.statusCode || 500).json({ success: false, message: e.statusCode ? e.message : 'The item request could not be completed.' }); }
};
router.get('/items', route(r => service.list(r.user.id, r.params.propertyId)));
router.post('/items', route(r => service.create(r.user.id, r.params.propertyId, r.body)));
router.post('/items/identify', costly,
  // Check home permission BEFORE accepting image bytes or invoking a paid service.
  (req,res,next) => service.permission(req.user.id, req.params.propertyId,true).then(() => next()).catch(e => res.status(e.statusCode || 500).json({ success:false,message:e.statusCode ? e.message : 'Home unavailable' })),
  (req,res,next) => upload.single('photo')(req,res,e => e ? res.status(400).json({ success:false,message:'Use one JPEG, PNG or WebP image under 5 MB.' }) : next()),
  route(async r => {
    validate(Joi.object({ method: Joi.string().valid('photo','text','document','code','online').required(), text: Joi.string().max(24000).allow(''), documentId: Joi.string().pattern(/^[1-9]\d*$/) }).required(), r.body);
    let text = r.body.text || '';
    const method = r.body.method;
    let image = null;
    if (method === 'photo') {
      const b = r.file?.buffer;
      const mime = r.file?.mimetype;
      const valid = b && ((mime === 'image/jpeg' && b[0] === 255 && b[1] === 216 && b[2] === 255) || (mime === 'image/png' && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (mime === 'image/webp' && b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP'));
      if (!valid) throw new ItemError('Choose a JPEG, PNG or WebP label photo under 5 MB.');
      image = `data:${mime};base64,${b.toString('base64')}`;
    }
    if (method === 'document') {
      const doc = await service.document(r.user.id, r.body.documentId);
      if (!doc.text_content) throw new ItemError('This document has no readable text yet. Try selected text or a label photo.');
      text = doc.text_content.slice(0,24000);
    }
    if (method === 'online') {
      if (!text.trim() || text.length > 300) throw new ItemError('Use a product description under 300 characters; leave out personal details and serial numbers.');
      const sources = await intelligence.discover(`${text} manufacturer model specifications`);
      if (!sources.length) return { candidates: [], sources, needsConfirmation: true, notes: 'No online candidates found. Try a label photo or selected receipt.' };
      const result = await intelligence.identify({ text: sources.map(s => `${s.title}\n${s.snippet}`).join('\n\n'), method });
      return { ...result, candidates: result.candidates.map(c => ({ ...c, sourceUrl: sources.find(s => `${s.title}\n${s.snippet}`.includes(c.quote))?.url || null })), sources };
    }
    return intelligence.identify({ text, image, method });
  }));
router.get('/items/:itemId', route(r => service.get(r.user.id,r.params.propertyId,r.params.itemId)));
router.patch('/items/:itemId', route(r => service.update(r.user.id,r.params.propertyId,r.params.itemId,r.body)));
router.post('/items/:itemId/evidence', route(r => service.attach(r.user.id,r.params.propertyId,r.params.itemId,r.body)));
router.delete('/items/:itemId/evidence/:evidenceId', route(r => service.detach(r.user.id,r.params.propertyId,r.params.itemId,r.params.evidenceId)));
router.post('/items/:itemId/manual-search', costly, route(async r => {
  const item = await service.find(r.user.id,r.params.propertyId,r.params.itemId);
  const { brand, model } = item.record.identity;
  if (!brand || !model) throw new ItemError('Confirm a brand and exact model first, or attach the manual you have.');
  return { sources: await intelligence.discover(`${brand} ${model} official manufacturer manual PDF`), notice: 'Search candidates need model and manufacturer verification. Linked content has not been retrieved or read.' };
}));
router.post('/items/:itemId/ask', costly, route(async r => {
  validate(Joi.object({ question:Joi.string().trim().min(1).max(4000).required(), evidenceIds:Joi.array().items(Joi.number().integer().positive()).min(1).max(4).unique().required() }).required(),r.body);
  const item = await service.get(r.user.id,r.params.propertyId,r.params.itemId);
  const sources = [];
  for (const evidenceId of r.body.evidenceIds) {
    const link = item.evidence.find(e => e.id === id(evidenceId));
    if (!link || link.matchStatus !== 'user_confirmed') throw new ItemError('Select confirmed evidence belonging to this item.');
    const doc = await service.document(r.user.id,link.documentId);
    if (!doc.text_content) throw new ItemError('A selected document is not readable yet.');
    sources.push({ id:link.id,name:doc.name,text:doc.text_content.slice(0,24000) });
  }
  return intelligence.answer(r.body.question,sources);
}));
module.exports = router;

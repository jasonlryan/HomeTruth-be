const Joi = require('joi');
const { ItemError, record, validate, id, readLevels, writeLevels } = require('./itemContract');
// Injectable dependencies keep permission/persistence tests independent of application startup.
module.exports = function createHomeItemService({ Item, Evidence, Person, Document, PropertyDocument, db }) {
  const permission = async (user, home, write = false) => {
    const relation = await Person.findOne({ where: { user_id: id(user), property_id: id(home), relationship_status: 'active' } });
    if (!relation) throw new ItemError('Home record not found', 404);
    if (!(write ? writeLevels : readLevels).has(relation.permission_level)) throw new ItemError('Permission required for this home', 403);
  };
  const find = async (user, home, itemId, write = false) => {
    await permission(user, home, write);
    const item = await Item.findOne({ where: { id: id(itemId), property_id: id(home), archived: false } });
    if (!item) throw new ItemError('Item not found', 404);
    return item;
  };
  const document = async (user, documentId, options = {}) => {
    const doc = await Document.findOne({ where: { id: id(documentId), user_id: id(user), is_active: true }, ...options });
    if (!doc) throw new ItemError('Document not found', 404);
    return doc;
  };
  const response = row => ({ id: row.id, propertyId: row.property_id, record: row.record, version: row.version, archived: row.archived, updatedAt: row.updatedAt });
  return {
    permission, document, find,
    async list(user, home) { await permission(user, home); return (await Item.findAll({ where: { property_id: id(home), archived: false }, order: [['id','DESC']] })).map(response); },
    async get(user, home, itemId) {
      const item = await find(user, home, itemId);
      const links = await Evidence.findAll({ where: { item_id: item.id } });
      const evidence = [];
      for (const link of links) {
        // Property access never grants access to another person's private documents.
        const doc = await Document.findOne({ where: { id: link.user_document_id, user_id: id(user), is_active: true } });
        if (doc) evidence.push({ id: link.id, documentId: doc.id, name: doc.name, status: doc.status, role: link.role, matchStatus: link.match_status, hasText: require('./itemSource').readable(doc) });
      }
      return { ...response(item), evidence };
    },
    async create(user, home, payload) {
      await permission(user, home, true);
      validate(Joi.object({ requestKey: Joi.string().guid().required(), record: record.required() }).required(), payload);
      const [row] = await Item.findOrCreate({ where: { property_id: id(home), request_key: payload.requestKey }, defaults: { created_by_user_id: id(user), record: payload.record, version: 1, archived: false } });
      return response(row);
    },
    async update(user, home, itemId, payload) {
      await find(user, home, itemId, true);
      validate(Joi.object({ version: Joi.number().integer().min(1).required(), record, archived: Joi.boolean() }).or('record','archived').required(), payload);
      const changes = { version: payload.version + 1 };
      if (payload.record) changes.record = payload.record;
      if (payload.archived !== undefined) changes.archived = payload.archived;
      const [count] = await Item.update(changes, { where: { id: id(itemId), property_id: id(home), version: payload.version, archived: false } });
      if (!count) throw new ItemError('This record changed. Reload before saving.', 409);
      return payload.archived ? { id: id(itemId), archived: true } : this.get(user, home, itemId);
    },
    async attach(user, home, itemId, payload) {
      const item = await find(user, home, itemId, true);
      validate(Joi.object({ documentId: Joi.number().integer().positive().required(), role: Joi.string().valid('manual','receipt','warranty','installation','service','other').required(), matchStatus: Joi.string().valid('unreviewed','user_confirmed','different_model').required() }), payload);
      return db.transaction(async transaction => {
      // Serialize associations through the original document, including cross-home checks.
      await document(user, payload.documentId, { transaction, lock: transaction.LOCK.UPDATE });
      const otherHomeLinks = await PropertyDocument.findAll({ where: { user_document_id: payload.documentId, is_active: true }, transaction });
      if (otherHomeLinks.some(l => l.property_id !== id(home))) throw new ItemError('This document is linked to a different home. Review that association first.', 409);
      const itemLinks = await Evidence.findAll({ where: { user_document_id: payload.documentId }, transaction });
      for (const link of itemLinks) {
        const linked = await Item.findOne({ where: { id: link.item_id }, transaction });
        if (linked && linked.property_id !== id(home)) throw new ItemError('This document is linked to a different home.', 409);
      }
      const [link] = await Evidence.findOrCreate({ where: { item_id: item.id, user_document_id: payload.documentId, role: payload.role }, defaults: { match_status: payload.matchStatus }, transaction });
      await link.update({ match_status: payload.matchStatus }, { transaction });
      return { linked: true };
      }).then(() => this.get(user, home, itemId));
    },
    async detach(user, home, itemId, evidenceId) {
      await find(user, home, itemId, true);
      const link = await Evidence.findOne({ where: { id: id(evidenceId), item_id: id(itemId) } });
      if (!link) throw new ItemError('Evidence not found', 404);
      await document(user, link.user_document_id);
      await link.destroy();
      return this.get(user, home, itemId);
    },
  };
};

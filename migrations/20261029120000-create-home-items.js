'use strict';
module.exports = {
  async up(q, S) {
    const timestamps = () => ({ created_at: { type: S.DATE, allowNull: false, defaultValue: S.literal('CURRENT_TIMESTAMP') }, updated_at: { type: S.DATE, allowNull: false, defaultValue: S.literal('CURRENT_TIMESTAMP') } });
    const ref = (model, nullable = false) => ({ type: S.INTEGER, allowNull: nullable, references: { model, key: 'id' }, onDelete: nullable ? 'SET NULL' : 'CASCADE', onUpdate: 'CASCADE' });
    await q.createTable('home_items', {
      id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
      property_id: ref('properties'), created_by_user_id: ref('users', true),
      request_key: { type: S.STRING(36), allowNull: false }, record: { type: S.JSON, allowNull: false },
      version: { type: S.INTEGER, allowNull: false, defaultValue: 1 }, archived: { type: S.BOOLEAN, allowNull: false, defaultValue: false }, ...timestamps(),
    });
    await q.addIndex('home_items', ['property_id','request_key'], { unique: true, name: 'home_items_request' });
    await q.addIndex('home_items', ['property_id','archived']);
    await q.createTable('home_item_evidence', {
      id: { type: S.INTEGER, primaryKey: true, autoIncrement: true }, item_id: ref('home_items'), user_document_id: ref('userDocuments'),
      role: { type: S.STRING(30), allowNull: false }, match_status: { type: S.STRING(30), allowNull: false }, ...timestamps(),
    });
    await q.addIndex('home_item_evidence', ['item_id','user_document_id','role'], { unique: true, name: 'home_item_evidence_unique' });
  },
  async down(q) { await q.dropTable('home_item_evidence'); await q.dropTable('home_items'); },
};

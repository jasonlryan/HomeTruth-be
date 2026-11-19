'use strict';

const pairs = [
  ['chat_history', 'chat_histories'],
  ['guest_chat_session', 'guest_chat_sessions'],
  ['user_document_chat_history', 'user_document_chat_histories'],
  ['waitlist', 'waitlists'],
];

// MySQL DDL commits independently. Each step is restartable and checks existing state.
// Stop application writers while running schema migrations.
module.exports = {
  async up(q, S) {
    const select = (sql, replacements = {}) => q.sequelize.query(sql, {
      type: S.QueryTypes.SELECT, replacements,
    });
    const exists = async table => (await select(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table', { table }
    )).length > 0;
    const count = async table => Number((await select(`SELECT COUNT(*) AS n FROM \`${table}\``))[0].n);
    const foreignKeys = async (table, column) => select(
      'SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column AND REFERENCED_TABLE_NAME IS NOT NULL',
      { table, column }
    );
    const assertReferences = async (table, column, parent) => {
      const rows = await select(`SELECT c.id FROM \`${table}\` c LEFT JOIN \`${parent}\` p ON p.id = c.\`${column}\` WHERE c.\`${column}\` IS NOT NULL AND p.id IS NULL LIMIT 1`);
      if (rows.length) throw new Error(`HT-355: ${table}.${column} contains orphan references. Reconcile before retrying; no records are deleted.`);
    };

    // Preflight all pairs before any destructive DDL. Never guess which conflicting
    // legacy IDs represent the same conversation or silently discard legacy data.
    for (const [legacy, canonical] of pairs) {
      if (await exists(legacy) && await exists(canonical) && await count(legacy)) {
        throw new Error(`HT-355: both ${legacy} and ${canonical} exist and ${legacy} contains data. Reconcile both datasets before retrying.`);
      }
    }
    const chatTarget = await exists('chat_histories') ? 'chat_histories' : 'chat_history';
    await assertReferences('saved_notes', 'chat_history_id', chatTarget);
    await assertReferences('quiz_answers', 'user_id', 'users');

    for (const [legacy, canonical] of pairs) {
      if (await exists(legacy) && !(await exists(canonical))) await q.renameTable(legacy, canonical);
    }

    const ensureForeignKey = async (table, column, parent, name) => {
      const keys = await foreignKeys(table, column);
      for (const key of keys) {
        if (key.REFERENCED_TABLE_NAME !== parent) await q.removeConstraint(table, key.CONSTRAINT_NAME);
      }
      if (!keys.some(key => key.REFERENCED_TABLE_NAME === parent)) {
        await q.addConstraint(table, {
          fields: [column], type: 'foreign key', name,
          references: { table: parent, field: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE',
        });
      }
    };
    await ensureForeignKey('saved_notes', 'chat_history_id', 'chat_histories', 'saved_notes_chat_history_fk');
    await ensureForeignKey('quiz_answers', 'user_id', 'users', 'quiz_answers_user_fk');

    const indexes = [
      ['chat_histories', ['user_id', 'createdAt', 'id'], 'chat_user_date_idx'],
      ['chat_histories', ['user_id', 'conversation_id', 'createdAt', 'id'], 'chat_user_conversation_date_idx'],
      ['chat_histories', ['user_id', 'is_saved', 'createdAt', 'id'], 'chat_user_saved_date_idx'],
      ['guest_chat_sessions', ['session_id', 'createdAt', 'id'], 'guest_session_date_idx'],
      ['user_document_chat_histories', ['user_id', 'document_id', 'created_at', 'id'], 'document_chat_user_date_idx'],
      ['user_document_chat_histories', ['user_id', 'document_id', 'conversation_id', 'created_at', 'id'], 'document_chat_conversation_date_idx'],
    ];
    for (const [table, fields, name] of indexes) {
      const current = await q.showIndex(table);
      if (!current.some(index => fields.every((field, i) => index.fields[i]?.attribute === field))) {
        await q.addIndex(table, fields, { name });
      }
    }

    for (const [legacy, canonical] of pairs) {
      const archive = `ht355_legacy_${legacy}`;
      if (await exists(legacy)) {
        // RENAME closes the old name before the final emptiness check. A concurrent
        // insert before the rename survives in the archive instead of being lost.
        const inbound = await select('SELECT TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = :legacy', { legacy });
        if (inbound.length) throw new Error(`HT-355: unexpected foreign keys still reference ${legacy}; reconcile before retrying.`);
        if (await exists(archive)) throw new Error(`HT-355: archive ${archive} already exists; inspect before retrying.`);
        await q.renameTable(legacy, archive);
      }
      if (await exists(archive)) {
        if (await count(archive)) throw new Error(`HT-355: late legacy writes preserved in ${archive}; reconcile into ${canonical} before retrying.`);
        await q.dropTable(archive);
      }
    }
  },

  async down() {
    throw new Error('HT-355 is forward-only. Restore a verified backup to reverse consolidation; automatic rollback could split or lose chat data.');
  },
};

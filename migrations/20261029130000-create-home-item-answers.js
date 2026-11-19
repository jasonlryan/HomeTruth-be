'use strict';

module.exports = {
  async up(q, S) {
    await q.createTable('home_item_answers', {
      id: {
        type: S.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      item_id: {
        type: S.INTEGER,
        allowNull: false,
        references: {
          model: 'home_items',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      user_id: {
        type: S.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      token_hash: {
        type: S.STRING(64),
        allowNull: false
      },
      content: {
        type: S.JSON,
        allowNull: false
      },
      created_at: {
        type: S.DATE,
        allowNull: false,
        defaultValue: S.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: S.DATE,
        allowNull: false,
        defaultValue: S.literal('CURRENT_TIMESTAMP')
      }
    });
    await q.addIndex('home_item_answers', ['item_id', 'user_id']);
    await q.addIndex('home_item_answers', ['user_id', 'token_hash'], {
      unique: true,
      name: 'home_item_answer_dedup'
    });
  },
  async down(q) {
    await q.dropTable('home_item_answers');
  }
};

// MySQL auto-commits DDL. Each step can resume after a partial migration.
const table = 'appliance_agent_runs';
const columns = S => ({
  execution: S.JSON,
  finished_at: S.DATE(3),
  usage: S.JSON
});
module.exports = {
  async up(q, S) {
    const existing = await q.describeTable(table);
    for (const [name, type] of Object.entries(columns(S))) {
      if (!existing[name]) await q.addColumn(table, name, { type, allowNull: true });
    }
    if (!(await q.showAllTables()).includes('agent_daily_spend')) {
      await q.createTable('agent_daily_spend', {
        user_id: {type: S.INTEGER, primaryKey: true, references: {model:'users', key:'id'}, onDelete:'CASCADE'},
        utc_day: {type: S.DATEONLY, primaryKey: true},
        reserved_micros: {type: S.BIGINT.UNSIGNED, allowNull: false}
      });
    }
  },
  async down(q, S = require('sequelize')) {
    await q.dropTable('agent_daily_spend');
    const existing = await q.describeTable(table);
    for (const name of Object.keys(columns(S))) if (existing[name]) await q.removeColumn(table, name);
  }
};

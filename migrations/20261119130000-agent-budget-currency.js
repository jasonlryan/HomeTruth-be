const table = 'agent_daily_spend';
module.exports = {
  async up(q, S) {
    if (!(await q.describeTable(table)).currency) {
      // Every reservation made by the previous release was denominated in USD.
      await q.addColumn(table, 'currency', { type: S.CHAR(3), allowNull: false, defaultValue: 'USD' });
    }
    await q.sequelize.query(`UPDATE appliance_agent_runs
      SET execution = JSON_SET(execution, '$.currency', 'USD')
      WHERE JSON_CONTAINS_PATH(execution, 'one', '$.reservedMicros')
        AND NOT JSON_CONTAINS_PATH(execution, 'one', '$.currency')`);
  },
  async down(q) {
    const [rows] = await q.sequelize.query("SELECT 1 FROM agent_daily_spend WHERE currency <> 'USD' LIMIT 1");
    if (rows.length) throw new Error('Retain the currency column while local-currency reservations exist.');
    await q.removeColumn(table, 'currency');
  }
};

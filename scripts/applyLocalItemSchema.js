// Additive local-only migration helper. Never accepts a remote host or drops existing records.
const fs = require('fs'),
  path = require('path');
const {
  Sequelize
} = require('sequelize');
async function main() {
  const source = path.resolve(__dirname, '../../HomeTruth_BE-staging/.env');
  require('dotenv').config({
    path: source
  });
  if (process.env.HT341_APPLY_LOCAL_SCHEMA !== 'true' || !['localhost', '127.0.0.1'].includes(process.env.DB_HOST)) throw new Error('Explicit local migration flag and loopback database required.');
  const db = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false
  });
  try {
    const q = db.getQueryInterface(),
      tables = await q.showAllTables();
    const snapshot = {};
    for (const table of tables) {
      if (!/^[A-Za-z0-9_]+$/.test(table)) throw new Error('Unexpected table name');
      const [rows] = await db.query(`SHOW CREATE TABLE \`${table}\``);
      snapshot[table] = rows[0]['Create Table'];
    }
    const dir = path.resolve(__dirname, '../../.local-backups');
    fs.mkdirSync(dir, {
      recursive: true
    });
    fs.writeFileSync(path.join(dir, `schema-before-ht341-${Date.now()}.json`), JSON.stringify(snapshot, null, 2), {
      mode: 0o600
    });
    if (!tables.includes('SequelizeMeta')) await q.createTable('SequelizeMeta', {
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      }
    });
    for (const [name, table] of [['20261029120000-create-home-items.js', 'home_items'], ['20261029130000-create-home-item-answers.js', 'home_item_answers'], ['20261029150000-create-appliance-agent-runs.js', 'appliance_agent_runs']]) {
      const [done] = await db.query('SELECT name FROM SequelizeMeta WHERE name = :name', {
        replacements: {
          name
        }
      });
      if (done.length) continue;
      if ((await q.showAllTables()).includes(table)) throw new Error('An untracked item table exists. Inspect before migrating.');
      await require(`../migrations/${name}`).up(q, Sequelize);
      await q.bulkInsert('SequelizeMeta', [{
        name
      }]);
    }
    console.log('PASS: additive HT-341 migrations applied to configured loopback development database; existing tables/data unchanged and schema snapshot saved.');
  } finally {
    await db.close();
  }
}
main().catch(e => {
  console.error(e.name, e.message);
  process.exitCode = 1;
});

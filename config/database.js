const { Sequelize } = require("sequelize");
const env = require('./../config/env');

const colors = require("colors");

const sequelize = new Sequelize(
  env.db.name,
  env.db.user,
  env.db.password,
  {
    host: env.db.host,
    dialect: "mysql",
    port: env.db.port || 3306, // Default MySQL port is 3306
    logging: false,
    // Connection pool settings to prevent timeouts
    pool: {
      max: 10, // Maximum number of connections in pool
      min: 2, // Minimum number of connections in pool
      acquire: 60000, // Maximum time (ms) to wait for a connection
      idle: 10000, // Maximum time (ms) a connection can be idle before being released
      evict: 1000 // Interval (ms) to check for idle connections
    },
    // Connection timeout settings
    connectTimeout: 30000, // 30 seconds connection timeout
    dialectOptions: {
      connectTimeout: 30000 // MySQL-specific connection timeout (30 seconds)
    }
  }
);
sequelize
  .authenticate()
  .then(() => {
    console.log(
      colors.bgMagenta(
        `Connected to MySQL ${env.db.name} DB successfully `
      )
    );
  })
  .catch((err) => {
    console.error("Error connecting to MySQL:", err);
  });
module.exports = sequelize;
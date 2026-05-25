const path = require("path");
const dotenv = require("dotenv");

const envFile = process.env.APP_ENV === "staging" ? ".env_staging" : ".env";
dotenv.config({ path: path.join(__dirname, "..", envFile) });

const databaseConfig = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD || null,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  dialect: "mysql",
  logging: false,
};

module.exports = {
  development: databaseConfig,
  test: databaseConfig,
  staging: databaseConfig,
  production: databaseConfig,
};

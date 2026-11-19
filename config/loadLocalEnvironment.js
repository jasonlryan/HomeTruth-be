const path = require('path');

// Only the local development environment exists today. Reject old selectors
// before opening a database connection, including selectors in .env.
function assertLocalEnvironment() {
  const appEnv = process.env.APP_ENV;
  if (appEnv && !['local', 'development', 'test'].includes(appEnv)) {
    throw new Error(`Unsupported APP_ENV=${appEnv}. HomeTruth has no staging or production environment configured.`);
  }
}
assertLocalEnvironment();
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
assertLocalEnvironment();

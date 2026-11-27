#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/../.."
set -a
source .investor-demo/local.env
set +a
[[ "$DB_NAME" == hometruth_investor_demo && "$DB_USER" == investor_demo && "$DB_HOST" == 127.0.0.1 && "$DB_PORT" == 3360 ]] || exit 1
lookup=false
openai_key=demo-disabled
if [[ "${1:-}" == "--live-manual" ]]; then
  : "${INVESTOR_DEMO_OPENAI_KEY:?Provide an approved investor lookup credential}"
  lookup=true
  openai_key="$INVESTOR_DEMO_OPENAI_KEY"
elif [[ $# != 0 ]]; then
  echo "Usage: $0 [--live-manual]" >&2
  exit 2
fi
# Keep the demo independent of developer credentials and shared retrieval collections.
exec env -i PATH="$PATH" HOME="$HOME" NODE_ENV=development APP_ENV=local \
  DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
  JWT_SECRET="$(openssl rand -hex 48)" PORT=8360 LISTEN_HOST=127.0.0.1 \
  FRONTEND_URL=http://localhost:3014 SERVER_BASE_URL=http://127.0.0.1:8360 APP_NAME=HomeTruth \
  HT_APPLIANCE_ITEMS_ENABLED=true APPLIANCE_AGENT_ENABLED="$lookup" APPLIANCE_AGENT_BUDGET_CURRENCY=GBP \
  SENDGRID_API_KEY=SG.demo-disabled OPENAI_API_KEY="$openai_key" SERPAPI_KEY=demo-disabled \
  AGENCY_REF=demo CLIENT_ID=demo CLIENT_SECRET=demo SSL=false QDRANT_URL=http://127.0.0.1:6360 \
  QDRANT_COLLECTION_NAME=investor_demo_documents QDRANT_USER_DOCUMENTS_COLLECTION=investor_demo_user_documents \
  node server.js

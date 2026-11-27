#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
root="$PWD"
dir="$root/scripts/investor-demo"
state="$root/.investor-demo"
umask 077
mkdir -p "$state/storage"
envfile="$state/local.env"
if [[ ! -e "$envfile" ]]; then
  tmp=$(mktemp "$state/credentials.XXXXXX")
  {
    echo DB_HOST=127.0.0.1
    echo DB_PORT=3360
    echo DB_USER=investor_demo
    echo DB_NAME=hometruth_investor_demo
    echo "DB_PASSWORD=$(openssl rand -hex 32)"
    echo "MAYA_PASSWORD=$(openssl rand -hex 24)"
    echo "ADMIN_PASSWORD=$(openssl rand -hex 24)"
  } > "$tmp"
  ln "$tmp" "$envfile" || { echo "Concurrent setup; retry." >&2; exit 1; }
  rm "$tmp"
fi
set -a
source "$envfile"
set +a
[[ "$DB_NAME" == hometruth_investor_demo && "$DB_USER" == investor_demo && "$DB_HOST" == 127.0.0.1 && "$DB_PORT" == 3360 ]] || { echo 'Unexpected demo target' >&2; exit 1; }
export DEMO_STORAGE="$state/storage"
compose=(docker compose --project-name hometruth-investor-demo --env-file "$envfile" -f "$dir/compose.yaml")
case "${1:-seed}" in
  seed) ;;
  reset)
    # Only this fixed Compose project and its private MySQL volume are reset.
    "${compose[@]}" down --volumes
    ;;
  *) echo "Usage: $0 [seed|reset]" >&2; exit 2 ;;
esac
"${compose[@]}" up -d --wait
# Verify the local port belongs to this project before running any migration.
[[ "$("${compose[@]}" port mysql 3306)" == "127.0.0.1:$DB_PORT" ]]
export APP_ENV=test
npm run db:migrate
manual="$DEMO_STORAGE/bosch-WAN28281GB.pdf"
if [[ ! -f "$manual" ]]; then
  tmp=$(mktemp "$DEMO_STORAGE/download.XXXXXX")
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    --max-time 90 https://media3.bosch-home.com/Documents/9001551191_B.pdf -o "$tmp"
  node -e 'const fs=require("fs"),crypto=require("crypto");if(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex")!=="0a16c42ca9930e5511a7c163986b84c2bb73b653fde14da810b5270659268845")process.exit(1)' "$tmp"
  mv "$tmp" "$manual"
fi
node "$dir/seed.js"
node "$dir/verify.js"

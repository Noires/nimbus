#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
project="nimbus-smoke-$(date +%s)-$$"
port="${NIMBUS_SMOKE_PORT:-$(node -e "const net = require('node:net'); const server = net.createServer(); server.listen(0, '127.0.0.1', () => { console.log(server.address().port); server.close(); });")}" 
export NIMBUS_SMOKE_PORT="$port"
export POSTGRES_PASSWORD="smoke-$project"

compose() {
  docker compose -p "$project" -f "$root/docker-compose.yml" -f "$root/test/compose.smoke.yml" "$@"
}

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    compose logs >&2 || true
  fi
  compose down -v --remove-orphans >&2 || true
  exit "$status"
}
trap cleanup EXIT INT TERM

compose up -d --build --wait --wait-timeout 180
health=$(curl --fail --silent --show-error --retry 12 --retry-delay 1 "http://127.0.0.1:$port/api/health")
printf '%s' "$health" | node -e "let body = ''; process.stdin.on('data', chunk => body += chunk).on('end', () => { if (JSON.parse(body).status !== 'ok') process.exit(1); });"
printf 'Compose smoke test passed at http://127.0.0.1:%s/api/health\n' "$port"

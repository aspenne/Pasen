#!/usr/bin/env bash
# Deploys whatever is currently checked out. Run on the server, or let the
# post-receive hook run it after a push.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
	echo "No .env here. Copy .env.prod.example and fill it in." >&2
	exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> building"
$COMPOSE build

echo "==> starting datastores"
$COMPOSE up -d postgres redis

# Migrations run against a database that is up but before the app serves
# traffic, so a request never meets a half-migrated schema.
echo "==> migrating"
$COMPOSE run --rm api node ace migration:run --force

echo "==> starting everything"
$COMPOSE up -d

echo "==> pruning old images"
docker image prune -f >/dev/null

echo "==> health"
for _ in $(seq 1 30); do
	if $COMPOSE exec -T api node -e 'fetch("http://127.0.0.1:3333/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' 2>/dev/null; then
		echo "healthy"
		exit 0
	fi
	sleep 2
done

echo "did not become healthy; check: $COMPOSE logs api" >&2
exit 1

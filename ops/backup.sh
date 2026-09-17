#!/usr/bin/env bash
# Nightly Postgres dump. The match history is expensive to rebuild - a full
# backfill of eleven accounts is tens of thousands of Riot requests and hours of
# waiting - so it is worth far more than the disk a dump costs.
set -euo pipefail

cd /srv/pasen
BACKUPS=/srv/backups
KEEP_DAYS=14

mkdir -p "$BACKUPS"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

# --clean so restoring into a non-empty database works without a manual drop.
docker compose -f docker-compose.prod.yml exec -T postgres \
	pg_dump -U "${DB_USER:-pasen}" -d "${DB_DATABASE:-pasen}" --clean --if-exists \
	| gzip > "$BACKUPS/pasen-$STAMP.sql.gz"

# A dump that failed halfway still produces a file, so check it decompresses.
gzip -t "$BACKUPS/pasen-$STAMP.sql.gz"

find "$BACKUPS" -name 'pasen-*.sql.gz' -mtime +$KEEP_DAYS -delete

echo "$(date -u +%FT%TZ) backup ok: $(du -h "$BACKUPS/pasen-$STAMP.sql.gz" | cut -f1)"

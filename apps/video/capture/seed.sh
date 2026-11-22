#!/usr/bin/env bash
# Seeds the local Docker fixtures (infra/docker-compose.yaml) with showcase demo data.
# Uses a separate `showcase` database in Postgres and Mongo and Redis db 1, so the
# `oh_my_query` fixtures and Redis db 0 stay untouched.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"

docker exec postgres psql -U omq -d postgres -qc "drop database if exists showcase"
docker exec postgres psql -U omq -d postgres -qc "create database showcase"
docker exec -i postgres psql -U omq -d showcase -q -v ON_ERROR_STOP=1 < "$here/seed-postgres.sql"

docker exec -i mongodb mongosh -u omq -p omq --authenticationDatabase admin --quiet showcase < "$here/seed-mongo.js"

docker exec -i redis redis-cli -n 1 < "$here/seed-redis.txt" > /dev/null

echo "Seeded Postgres showcase, Mongo showcase.orders and Redis db 1."

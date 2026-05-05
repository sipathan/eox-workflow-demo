#!/usr/bin/env sh
# Same outcome as npm run db:reset, but inside the Compose "app" service (EC2 / full-stack Docker).
# Requires: docker compose up (app + postgres healthy). DATABASE_URL comes from compose env.
set -e
cd "$(dirname "$0")/.."
exec docker compose exec app npx prisma migrate reset --force

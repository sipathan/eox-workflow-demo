#!/usr/bin/env sh
# Wipe the target Postgres database, reapply all migrations, and run prisma seed.
# Uses DATABASE_URL from .env (Prisma loads it from the repo root). For local dev only.
set -e
cd "$(dirname "$0")/.."
exec npx prisma migrate reset --force

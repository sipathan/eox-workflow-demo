#!/bin/sh
set -e
echo "[entrypoint] Applying Prisma migrations..."
npx prisma migrate deploy
echo "[entrypoint] Starting Next.js (production)..."
exec npm run start

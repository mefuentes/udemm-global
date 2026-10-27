#!/bin/sh
set -e

echo "[start.sh] Running Prisma migrations..."
node_modules/.bin/prisma migrate deploy

echo "[start.sh] Migrations applied. Starting application..."
exec node dist/main.js

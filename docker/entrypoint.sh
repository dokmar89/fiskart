#!/bin/sh
# Brings the database up to date, then starts the app. Both steps are safe to repeat on every start.
set -e
echo "Applying database migrations…"
node_modules/.bin/prisma migrate deploy
echo "Seeding built-in templates…"
node_modules/.bin/tsx prisma/seed.ts
echo "Starting FiskART on port ${PORT}…"
exec node_modules/.bin/next start --port "${PORT}" --hostname "${HOSTNAME}"

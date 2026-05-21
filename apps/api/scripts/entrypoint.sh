#!/bin/sh
set -e

# Apply any pending migrations before serving traffic. We use the
# locally-installed prisma binary from the deployed package so we don't
# need a separate "migrate" container.
if [ -d "/app/prisma" ]; then
  echo "[entrypoint] running prisma migrate deploy..."
  ./node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma
fi

exec "$@"

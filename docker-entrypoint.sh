#!/usr/bin/env sh
set -eu

cd /app/api
pnpm db:migrate
cd /app
exec pnpm --filter api start

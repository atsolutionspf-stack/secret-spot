#!/usr/bin/env bash
# Runs the SQL checks in a THROWAWAY local Postgres (never Supabase). Requires postgres binaries.
set -euo pipefail
cd "$(dirname "$0")"
BIN=${PG_BIN:-/usr/lib/postgresql/15/bin}
DIR=$(mktemp -d); PORT=55432
RUN="sudo -u postgres"; [ "$(id -u)" != 0 ] && RUN=""
[ -n "$RUN" ] && chown postgres "$DIR"
$RUN "$BIN/initdb" -D "$DIR" -A trust -U postgres >/dev/null
$RUN "$BIN/pg_ctl" -D "$DIR" -o "-p $PORT -k /tmp" -l "$DIR/log" -w start >/dev/null
trap '$RUN "$BIN/pg_ctl" -D "$DIR" -m immediate stop >/dev/null; rm -rf "$DIR"' EXIT
PSQL="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "create database t"
$PSQL -d t -f fake_schema.sql
$PSQL -d t -f ../../sql/create_pickup_order.sql
$PSQL -d t -f ../../sql/create_pickup_order.sql   # idempotent re-run
$PSQL -d t -f test_create_pickup_order.sql

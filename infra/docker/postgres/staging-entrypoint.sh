#!/bin/sh
# Staging's Postgres, reachable from developers' laptops (DOKPLOY.md, Developer
# access to staging).
#
# Writes the TLS pair handed in as base64 to the container's own disk, readable
# by postgres alone, then starts the image's own entrypoint with TLS on and
# staging's own client rules (staging-pg-hba.conf). Nothing lands on the data
# volume, so replacing the pair is a change to two variables and a restart.
#
# Without the pair the server starts without TLS. The rules file admits a
# connection from outside the compose networks over TLS only, so a missing pair
# closes developer access instead of opening it in plain text.
set -eu

TLS_DIR=/var/lib/postgresql/tls

set -- postgres -c hba_file=/etc/postgresql/staging-pg-hba.conf "$@"

if [ -n "${PG_TLS_CERT_B64:-}" ] && [ -n "${PG_TLS_KEY_B64:-}" ]; then
  mkdir -p "$TLS_DIR"
  printf '%s' "$PG_TLS_CERT_B64" | base64 -d > "$TLS_DIR/server.crt"
  printf '%s' "$PG_TLS_KEY_B64" | base64 -d > "$TLS_DIR/server.key"
  chown -R postgres:postgres "$TLS_DIR"
  chmod 0644 "$TLS_DIR/server.crt"
  chmod 0600 "$TLS_DIR/server.key"
  set -- "$@" -c ssl=on \
    -c ssl_cert_file="$TLS_DIR/server.crt" \
    -c ssl_key_file="$TLS_DIR/server.key"
else
  echo "staging-entrypoint: PG_TLS_CERT_B64 or PG_TLS_KEY_B64 is unset;" \
    "starting without TLS, so nothing outside the stack can connect" >&2
fi

# The server needs neither once the files exist.
unset PG_TLS_CERT_B64 PG_TLS_KEY_B64
exec docker-entrypoint.sh "$@"

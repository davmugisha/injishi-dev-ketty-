#!/bin/sh
# One shot, on every `up`: the developer login on staging's database (DOKPLOY.md,
# Developer access to staging).
#
# `injishi_dev` holds the owner role's privileges by inheritance and nothing
# more. It reads and writes every table the API does and can apply a migration,
# but it is not a superuser and cannot SET ROLE to one (WITH SET FALSE), so a
# leaked developer password is a staging data problem, never a shell inside the
# database container. staging-pg-hba.conf admits it from outside the stack over
# TLS only, and admits nobody else from outside at all.
#
# With STAGING_DB_DEV_PASSWORD unset the login is switched off rather than left
# on an old password, which is how developer access is withdrawn.
set -eu

export PGPASSWORD="$POSTGRES_PASSWORD"
psql_owner() {
  psql -v ON_ERROR_STOP=1 -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

if [ -z "${STAGING_DB_DEV_PASSWORD:-}" ]; then
  psql_owner <<'SQL'
SELECT 'ALTER ROLE injishi_dev NOLOGIN'
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'injishi_dev') \gexec
SQL
  echo "injishi_dev: login off (STAGING_DB_DEV_PASSWORD is unset)"
  exit 0
fi

# CONNECTION LIMIT keeps laptops from taking the connections the stack's own
# API and worker need (max_connections is the image default, 100).
psql_owner -v owner="$POSTGRES_USER" -v pw="$STAGING_DB_DEV_PASSWORD" <<'SQL'
SELECT 'CREATE ROLE injishi_dev'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'injishi_dev') \gexec
ALTER ROLE injishi_dev WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 40 PASSWORD :'pw';
GRANT :"owner" TO injishi_dev WITH INHERIT TRUE, SET FALSE;
SQL
echo "injishi_dev: login on, inherits $POSTGRES_USER, cannot SET ROLE to it"

#!/usr/bin/env bash
# Rebuild the public demo from staging's current commit (ADR-043, AC-29 to AC-31).
#
# Run by host cron at 03:00 Africa/Kigali, which is 01:00 UTC (Rwanda keeps no
# daylight saving):
#
#   0 1 * * * /opt/injishi-demo/src/infra/docker/demo-nightly.sh >> /var/log/injishi-demo-nightly.log 2>&1
#
# and by hand for the demo's FIRST bring up, which is the same path: with no
# demo running yet, the swap below simply has nothing to keep.
#
# In order, stopping at the first failure:
#
#   1. Read staging's commit and check it out in the demo's own checkout.
#   2. Build every demo image as `:demo-next`, stamped with that commit.
#   3. Create `injishi_demo_next` and, with the `:demo-next` API image, migrate
#      it, mark it sample and run the sample recipe against it.
#   4. SWAP, reached only when 1 to 3 succeeded: stop the demo's app services,
#      end every connection, rename the live database to `injishi_demo_prev`
#      and `injishi_demo_next` to `injishi_demo`, keep the current images as
#      `:demo-prev` and retag `:demo-next` as `:demo`, empty the bucket, flush
#      Redis, empty Mailpit, start the demo again.
#   5. CONFIRM the API and web health checks. Healthy: drop the previous
#      database and images. Not healthy in time: swap both back, exit non zero.
#   6. Any failure before the swap drops the candidate database and images and
#      leaves the running demo untouched, then exits non zero.
#
# The bucket, Redis and Mailpit are emptied at the swap and are NOT restored by
# a swap back: the restored database then points at uploads that are gone,
# which a demo tolerates until the next night. Sessions die at the swap.
#
# It never reads a secret itself. The candidate database's URL is derived inside
# the candidate container from the service's own DATABASE_URL, and MinIO's root
# pair is read inside the minio-init container, from its own environment.
#
# Settings, all optional:
#   DEMO_ROOT        /opt/injishi-demo          the demo's home (.env, src/)
#   STAGING_SRC      /opt/injishi-staging/src   staging's checkout
#   HEALTH_TIMEOUT   600                        seconds to wait at the confirm
#   NIGHTLY_LOCK_RETRY_MINUTES  90              how long to wait for the lock
#
# Output is split on purpose (ADR-052 AC-22b). Progress goes to stdout, every
# failure goes to stderr, and the cron line sends stdout to the log while
# leaving stderr alone:
#
#   MAILTO=<the maintainer>
#   0 1 * * * .../demo-nightly.sh >> /var/log/injishi-demo-nightly.log
#
# cron mails whatever a job writes and nothing else, so that line mails a
# failure and stays silent on a good night. Redirecting stderr into the log as
# well (`2>&1`) is what made this job the one failure nobody could see: it is a
# host cron job, so GitHub cannot report it.
set -Eeuo pipefail

DEMO_ROOT=${DEMO_ROOT:-/opt/injishi-demo}
STAGING_SRC=${STAGING_SRC:-/opt/injishi-staging/src}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-600}
NIGHTLY_LOCK_RETRY_MINUTES=${NIGHTLY_LOCK_RETRY_MINUTES:-90}
DEMO_SRC="$DEMO_ROOT/src"
ENV_FILE="$DEMO_ROOT/.env"
PROJECT=injishi-demo
COMPOSE_FILE=infra/docker/docker-compose.demo.yml
# The four images the stack builds; `worker` runs the api image.
IMAGES=(injishi-api injishi-web injishi-app injishi-admin)
APP_SERVICES=(api worker web app admin)
LIVE_DB=injishi_demo
NEXT_DB=injishi_demo_next
PREV_DB=injishi_demo_prev

log() { printf '%s demo-nightly: %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "FAILED: $*" >&2; exit 1; }

# Step 1 rewrites this very file (it lives in the checkout it updates), and
# bash reads a script as it runs. So run from a private copy.
if [[ -z ${DEMO_NIGHTLY_COPY:-} ]]; then
  copy=$(mktemp /tmp/demo-nightly.XXXXXX.sh)
  cp "$0" "$copy"
  DEMO_NIGHTLY_COPY=$copy exec bash "$copy" "$@"
fi
trap 'rm -f "$DEMO_NIGHTLY_COPY"' EXIT

# One run at a time. A slow build overlapping the next night's run would swap
# twice over one database.
#
# The lock is shared with the GitHub Actions deploy jobs (ADR-052 AC-18): one
# host cannot build two stacks at once. It used to be taken with `flock -n`,
# which dies on the first attempt, so a deploy that happened to hold it at 01:00
# UTC would cancel that night's rebuild outright. It waits now, and gives up
# only after NIGHTLY_LOCK_RETRY_MINUTES, because a rebuild that starts an hour
# late is worth far more than one that never ran (AC-18b).
exec 9>/var/lock/injishi-demo-nightly.lock
lock_wait=$(( NIGHTLY_LOCK_RETRY_MINUTES * 60 ))
if ! flock -n 9; then
  log "/var/lock/injishi-demo-nightly.lock is held; waiting up to ${NIGHTLY_LOCK_RETRY_MINUTES}m for it"
  flock -w "$lock_wait" 9 || die "gave up after ${NIGHTLY_LOCK_RETRY_MINUTES}m waiting for /var/lock/injishi-demo-nightly.lock; a deploy or another run held it the whole time"
  log "took the lock after waiting"
fi

[[ -f $ENV_FILE ]] || die "$ENV_FILE is missing (copy infra/docker/dokploy-demo.env.example)"
[[ -d $DEMO_SRC/.git ]] || die "$DEMO_SRC is not a git checkout of the injishi repo"
[[ -d $STAGING_SRC/.git ]] || die "$STAGING_SRC is not staging's checkout"

compose() {
  docker compose -p "$PROJECT" -f "$DEMO_SRC/$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# SQL against the maintenance database, as the db container's own user.
psql_admin() {
  compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -qAt -U "$POSTGRES_USER" -d postgres' <<<"$1"
}

db_exists() {
  [[ $(psql_admin "select 1 from pg_database where datname = '$1'") == 1 ]]
}

image_exists() { docker image inspect "$1" >/dev/null 2>&1; }

# ── failure before the swap: throw the candidate away, touch nothing live ─────
phase=prepare
cleanup_candidate() {
  log "dropping the candidate ($NEXT_DB, :demo-next images); the running demo is untouched"
  psql_admin "drop database if exists $NEXT_DB with (force)" || true
  for image in "${IMAGES[@]}"; do docker image rm "$image:demo-next" >/dev/null 2>&1 || true; done
}
on_error() {
  local status=$?
  if [[ $phase == prepare ]]; then
    cleanup_candidate
  fi
  log "FAILED in phase '$phase' (exit $status)" >&2
  exit "$status"
}
trap on_error ERR

# ── 1. staging's commit ─────────────────────────────────────────────────────────
commit=$(git -C "$STAGING_SRC" rev-parse HEAD)
short=$(git -C "$STAGING_SRC" rev-parse --short HEAD)
log "staging is at $short; checking it out in $DEMO_SRC"
git -C "$DEMO_SRC" fetch --quiet origin
git -C "$DEMO_SRC" checkout --quiet --detach "$commit"

# The backing services are started (or reconciled with the checked out compose
# file) before anything else: the candidate database is created inside db.
compose up -d --no-build db redis minio mailpit
compose exec -T db sh -c 'until pg_isready -q -U "$POSTGRES_USER"; do sleep 1; done'

# ── 2. build the candidate images ─────────────────────────────────────────────────
log "building :demo-next images at $short"
DEMO_IMAGE_TAG=demo-next INJISHI_COMMIT=$short compose build api web app admin

# ── 3. a fresh candidate database: migrate, mark, seed ────────────────────────────
log "creating $NEXT_DB and running the sample recipe into it"
psql_admin "drop database if exists $NEXT_DB with (force)"
psql_admin "create database $NEXT_DB"
# The same one time container a first bring up uses (AC-31). DATABASE_URL is
# rewritten to the candidate INSIDE the container, from the service's own.
DEMO_IMAGE_TAG=demo-next compose run --rm --no-deps -T api sh -c '
  set -e
  DATABASE_URL=$(node -e "
    const u = new URL(process.env.DATABASE_URL);
    if (u.pathname !== \"/'"$LIVE_DB"'\") throw new Error(\"DATABASE_URL must name the database '"$LIVE_DB"'\");
    u.pathname = \"/'"$NEXT_DB"'\";
    console.log(u.toString());
  ")
  export DATABASE_URL
  node scripts/migrate.mjs
  node scripts/mark-sample-database.mjs --sample
  node scripts/seed-sample.mjs
'

# ── 4. swap ───────────────────────────────────────────────────────────────────────
phase=swap
had_previous=false
image_exists "injishi-api:demo" && had_previous=true
log "swapping in the candidate (previous demo kept: $had_previous)"

compose stop "${APP_SERVICES[@]}"
psql_admin "select pg_terminate_backend(pid) from pg_stat_activity
            where datname in ('$LIVE_DB', '$NEXT_DB') and pid <> pg_backend_pid()" >/dev/null
psql_admin "drop database if exists $PREV_DB with (force)"
if db_exists "$LIVE_DB"; then
  psql_admin "alter database $LIVE_DB rename to $PREV_DB"
fi
psql_admin "alter database $NEXT_DB rename to $LIVE_DB"

for image in "${IMAGES[@]}"; do
  if image_exists "$image:demo"; then docker tag "$image:demo" "$image:demo-prev"; fi
  docker tag "$image:demo-next" "$image:demo"
  docker image rm "$image:demo-next" >/dev/null
done

# The bucket: emptied with MinIO's root pair, read inside minio-init from its
# own environment and handed to mc on stdin, never on a command line. Absent on
# a first bring up, which minio-init then creates.
compose run --rm --no-deps -T --entrypoint sh minio-init -c '
  set -e
  export MC_CONFIG_DIR=$(mktemp -d)
  printf "%s\n%s\n" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" |
    mc --no-color alias set --api S3v4 --path on demo http://injishi-minio:9000 >/dev/null
  if mc --no-color ls "demo/$STORAGE_BUCKET" >/dev/null 2>&1; then
    mc --no-color rm --recursive --force "demo/$STORAGE_BUCKET" >/dev/null || true
  fi
'
compose exec -T redis redis-cli FLUSHALL >/dev/null
compose restart mailpit >/dev/null

compose up -d --no-build

# ── 5. confirm ────────────────────────────────────────────────────────────────────
phase=confirm
health_of() {
  local id
  id=$(compose ps -q "$1")
  [[ -n $id ]] || { echo missing; return; }
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id"
}

deadline=$((SECONDS + HEALTH_TIMEOUT))
healthy=false
while ((SECONDS < deadline)); do
  if [[ $(health_of api) == healthy && $(health_of web) == healthy ]]; then
    healthy=true
    break
  fi
  sleep 10
done

if $healthy; then
  log "healthy on $short; dropping the previous database and images"
  psql_admin "drop database if exists $PREV_DB with (force)"
  for image in "${IMAGES[@]}"; do docker image rm "$image:demo-prev" >/dev/null 2>&1 || true; done
  log "done: the demo runs $short"
  exit 0
fi

# Not healthy in time: put yesterday's demo back (AC-30).
log "the new demo is not healthy after ${HEALTH_TIMEOUT}s (api: $(health_of api), web: $(health_of web)); swapping back"
trap - ERR
set +e
compose stop "${APP_SERVICES[@]}"
psql_admin "select pg_terminate_backend(pid) from pg_stat_activity
            where datname in ('$LIVE_DB', '$PREV_DB') and pid <> pg_backend_pid()" >/dev/null
if $had_previous && db_exists "$PREV_DB"; then
  psql_admin "drop database if exists $NEXT_DB with (force)"
  psql_admin "alter database $LIVE_DB rename to $NEXT_DB"
  psql_admin "alter database $PREV_DB rename to $LIVE_DB"
  for image in "${IMAGES[@]}"; do
    image_exists "$image:demo-prev" && docker tag "$image:demo-prev" "$image:demo" && docker image rm "$image:demo-prev" >/dev/null
  done
  compose up -d --no-build
  die "swapped back to the previous demo; the failed candidate database is kept as $NEXT_DB for inspection"
fi
die "there was no previous demo to swap back to (a first bring up); the demo stays down"

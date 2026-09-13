#!/usr/bin/env bash
# Deploy one stack to the commit it is told to run.
#
# ADR-052. Called by `.github/workflows/deploy-staging.yml` and
# `deploy-production.yml`, both of which run on the self hosted runner ON this
# VPS. The logic lives here rather than in the workflow YAML for the same reason
# demo-nightly.sh exists: a deploy is a sequence with a rollback, and a sequence
# with a rollback belongs in a file you can read, run by hand and test.
#
# What it does, stopping at the first failure:
#   1. Take the shared build lock, waiting for it rather than dying (AC-18).
#   2. Check the commit out in the stack's own source tree.
#   3. PULL the API image from GHCR by tag. It is never built here: it was built
#      once, by `image.yml`, from the commit being deployed (AC-9, AC-10).
#   4. BUILD the three frontends here. They bake per stack NEXT_PUBLIC_* values
#      at image build time, so their images are stack specific and cannot be
#      promoted from a registry (AC-10).
#   5. Bring the stack up and wait for `api` and `web` to report healthy
#      (AC-12).
#   6. With --rollback, an unhealthy result puts the previous images back and
#      exits non zero (AC-16). Without it, an unhealthy result just fails.
#
# Usage:
#   deploy-stack.sh --stack staging|production --commit <sha> [--rollback]
#
# Settings, all optional:
#   DEPLOY_HEALTH_TIMEOUT  600   seconds to wait for api and web to be healthy
#   DEPLOY_LOCK_TIMEOUT    1800  seconds to wait for the build lock
#   GHCR_IMAGE   ghcr.io/hangaasoftwares/injishi-api   the API image repository
#
# It never reads an application secret. Every stack value lives in that stack's
# own .env on this host and is never passed in from GitHub, which is one of the
# reasons the runner lives here at all.
#
# Progress goes to stdout and every failure to stderr, so a caller can log one
# and surface the other.
set -Eeuo pipefail

STACK=""
COMMIT=""
ROLLBACK=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stack) STACK=${2:-}; shift 2 ;;
    --commit) COMMIT=${2:-}; shift 2 ;;
    --rollback) ROLLBACK=true; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

log() { printf '%s deploy-stack: %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { printf '%s deploy-stack: FAILED: %s\n' "$(date -u +%FT%TZ)" "$*" >&2; exit 1; }

[[ -n $STACK ]] || die "--stack is required (staging or production)"
[[ -n $COMMIT ]] || die "--commit is required"
[[ $COMMIT =~ ^[0-9a-f]{7,40}$ ]] || die "--commit must be a git sha, got '$COMMIT'"

case "$STACK" in
  staging)
    STACK_ROOT=${STACK_ROOT:-/opt/injishi-staging}
    PROJECT=injishi-staging
    COMPOSE_FILE=infra/docker/docker-compose.staging.yml
    ;;
  production)
    STACK_ROOT=${STACK_ROOT:-/opt/injishi}
    PROJECT=injishi
    COMPOSE_FILE=infra/docker/docker-compose.dokploy.yml
    ;;
  *) die "--stack must be staging or production, got '$STACK'" ;;
esac

SRC="$STACK_ROOT/src"
ENV_FILE="$STACK_ROOT/.env"
HEALTH_TIMEOUT=${DEPLOY_HEALTH_TIMEOUT:-600}
LOCK_TIMEOUT=${DEPLOY_LOCK_TIMEOUT:-1800}
GHCR_IMAGE=${GHCR_IMAGE:-ghcr.io/hangaasoftwares/injishi-api}
# Built on this host, so these are the ones a rollback has to put back by hand.
FRONTEND_IMAGES=(injishi-web injishi-app injishi-admin)
FRONTEND_SERVICES=(web app admin)

[[ -f $ENV_FILE ]] || die "$ENV_FILE is missing"
[[ -d $SRC/.git ]] || die "$SRC is not a git checkout of the injishi repo"

# ── the shared build lock ───────────────────────────────────────────────────────
# One host cannot build two stacks at once, and demo-nightly.sh takes this same
# lock. Waiting is the point: a deploy that collides with the nightly should
# queue behind it, not fail and not build alongside it (AC-18).
exec 9>/var/lock/injishi-demo-nightly.lock
if ! flock -n 9; then
  log "the build lock is held; waiting up to ${LOCK_TIMEOUT}s"
  flock -w "$LOCK_TIMEOUT" 9 \
    || die "gave up after ${LOCK_TIMEOUT}s waiting for /var/lock/injishi-demo-nightly.lock. Refusing to build alongside whatever holds it."
fi
log "holding the build lock"

compose() {
  docker compose -p "$PROJECT" -f "$SRC/$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# ── what is running now, so a rollback has somewhere to go back to ─────────────
# Read through docker's own compose LABELS, not through `compose ps`. The api
# service names ghcr.io/...:${INJISHI_API_TAG:?...}, and that variable is not
# set yet at this point, so any compose call here would fail on interpolation.
# It would fail quietly too, because this line cannot be allowed to abort the
# deploy, and an empty answer here means a rollback with nothing to roll back
# to. Asking docker directly sidesteps the interpolation entirely.
previous_api_image=$(
  docker ps --filter "label=com.docker.compose.project=$PROJECT" \
            --filter "label=com.docker.compose.service=api" \
            --format '{{.Image}}' | head -n1
)
if [[ -n $previous_api_image ]]; then
  log "currently running API image: $previous_api_image"
else
  log "no API container is running; there is nothing to roll back to"
  if $ROLLBACK; then
    log "continuing with --rollback anyway: an unhealthy result will fail without restoring"
  fi
fi

# The frontends are host built and carry no version in their tag, so the only
# way back to them is to keep a second tag pointing at the same image id. Same
# mechanism demo-nightly.sh uses for :demo-prev.
for image in "${FRONTEND_IMAGES[@]}"; do
  if docker image inspect "$image:$STACK" >/dev/null 2>&1; then
    docker tag "$image:$STACK" "$image:$STACK-prev"
    log "kept $image:$STACK as $image:$STACK-prev"
  fi
done

# ── the commit ─────────────────────────────────────────────────────────────────
log "checking $COMMIT out in $SRC"
git -C "$SRC" fetch --quiet origin
git -C "$SRC" checkout --quiet --force "$COMMIT"
checked_out=$(git -C "$SRC" rev-parse HEAD)
log "$SRC is at $checked_out"

# ── the API image, pulled and never built ──────────────────────────────────────
short=$(git -C "$SRC" rev-parse --short HEAD)
export INJISHI_API_TAG="$short"
export INJISHI_COMMIT="$short"
log "pulling $GHCR_IMAGE:$short"
compose pull api worker \
  || die "could not pull $GHCR_IMAGE:$short. Has image.yml finished for this commit, and can this host read the registry?"

# ── the frontends, built here because they bake per stack values ───────────────
log "building the frontends on this host"
compose build "${FRONTEND_SERVICES[@]}"

# ── up, and wait ───────────────────────────────────────────────────────────────
log "bringing $PROJECT up"
compose up -d --remove-orphans

health_of() {
  local id
  id=$(compose ps -q "$1")
  [[ -n $id ]] || { echo missing; return; }
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id"
}

log "waiting up to ${HEALTH_TIMEOUT}s for api and web to report healthy"
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
  log "$PROJECT is healthy on $short"
  for image in "${FRONTEND_IMAGES[@]}"; do
    docker image rm "$image:$STACK-prev" >/dev/null 2>&1 || true
  done
  log "done"
  exit 0
fi

log "api=$(health_of api) web=$(health_of web) after ${HEALTH_TIMEOUT}s"

if ! $ROLLBACK; then
  die "$PROJECT did not become healthy on $short. Left as it is, on purpose: this stack is where a bad commit is supposed to be visible."
fi

# ── rollback (AC-16) ───────────────────────────────────────────────────────────
# Images only. Any migration this release applied STAYS APPLIED, so the restored
# image now runs against a schema newer than the one it shipped with. That is
# why a migration shipped beside a risky change has to stay backward compatible
# with the release before it: add the column, do not rename it, and drop it a
# release later. Nothing in this pipeline can enforce that.
trap - ERR
set +e

# Nothing to go back to. Bringing the stack up again here would simply restart
# the release that just failed, on the same images, and report it as a rollback.
if [[ -z $previous_api_image ]]; then
  die "$short was not healthy, and there is no previous release to restore: no api container was running when this deploy started. $PROJECT needs a person."
fi

log "rolling back to $previous_api_image"

for image in "${FRONTEND_IMAGES[@]}"; do
  if docker image inspect "$image:$STACK-prev" >/dev/null 2>&1; then
    docker tag "$image:$STACK-prev" "$image:$STACK"
    log "restored $image:$STACK"
  fi
done

previous_tag=${previous_api_image##*:}
export INJISHI_API_TAG="$previous_tag"
export INJISHI_COMMIT="$previous_tag"

compose up -d --no-build --remove-orphans

restore_deadline=$((SECONDS + HEALTH_TIMEOUT))
restored=false
while ((SECONDS < restore_deadline)); do
  if [[ $(health_of api) == healthy && $(health_of web) == healthy ]]; then
    restored=true
    break
  fi
  sleep 10
done

if $restored; then
  die "$short was not healthy. The previous images are back and $PROJECT is serving on them. The SCHEMA was not rolled back."
fi

die "$short was not healthy AND the rollback did not come up either. $PROJECT needs a person. Start at: docker compose -p $PROJECT logs api"

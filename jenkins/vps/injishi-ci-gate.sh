#!/bin/bash
# The SSH forced command of Jenkins' key for hangaasoftwares/injishi, installed
# on the VPS (sshami-vps, 102.202.208.167) as /usr/local/bin/injishi-ci-gate.
#
# ADR-052 put a GitHub Actions runner ON the VPS so that no key reaching it sat
# outside it. Jenkins runs on another server, so a key has to exist; this script
# is what keeps it narrow. The key (Jenkins credential injishi-vps-ssh, comment
# jenkins-injishi) is in /home/gha-runner/.ssh/authorized_keys with
# `restrict,from="179.197.85.203",command="/usr/local/bin/injishi-ci-gate"`, so
# it runs as gha-runner, the non-root docker-group user the runner ran as
# (AC-17), and can do only what the former workflow steps did on that runner:
#
#   deploy staging|production <sha> <health-timeout-s> <lock-timeout-s>
#       deploy-staging.yml / deploy-production.yml's "Deploy" step: check the
#       commit out in the stack's own tree and run that tree's deploy-stack.sh
#       (production with --rollback).
#   serving staging|production
#       their "What is serving now" step.
#   backup
#       backup.yml, every step.
#   schema-dump
#       schema-capture.yml's dump: production's schema, rows excluded, on
#       stdout. Jenkins checks it and publishes it; this host holds no
#       registry credential.
#
# Anything else is refused. Host settings stay on this host (ADR-052, "Stack
# settings live on the VPS"): `backup` reads BACKUP_DESTINATION,
# BACKUP_ENCRYPTION_RECIPIENT and BACKUP_RETENTION_DAYS from
# /home/gha-runner/injishi-ci.env (KEY=value lines, owner gha-runner, mode 600),
# where the runner's own .env used to supply them.
#
# Install as root, and again after every change to this file in the repository:
#   install -o root -g root -m 0755 jenkins/vps/injishi-ci-gate.sh /usr/local/bin/injishi-ci-gate
set -euo pipefail

SETTINGS=/home/gha-runner/injishi-ci.env

cmd=${SSH_ORIGINAL_COMMAND:-}
logger -t injishi-ci-gate -- "$cmd" 2>/dev/null || true

deploy() { # stack commit health-timeout lock-timeout
  local stack=$1 commit=$2 src
  local rollback=()
  case "$stack" in
    staging) src=/opt/injishi-staging/src ;;
    production) src=/opt/injishi/src; rollback=(--rollback) ;;
  esac
  # Update the checkout first so the deploy script itself is the version that
  # belongs to the commit being deployed.
  git -C "$src" fetch --quiet origin
  git -C "$src" checkout --quiet --force "$commit"
  DEPLOY_HEALTH_TIMEOUT=$3 DEPLOY_LOCK_TIMEOUT=$4 \
    exec bash "$src/infra/docker/deploy-stack.sh" --stack "$stack" --commit "$commit" "${rollback[@]}"
}

serving() { # stack
  set +e
  case "$1" in
    staging)
      echo "checkout: $(git -C /opt/injishi-staging/src rev-parse HEAD)"
      docker compose -p injishi-staging ps
      ;;
    production)
      echo "checkout: $(git -C /opt/injishi/src rev-parse HEAD)"
      docker compose -p injishi ps
      docker image ls --filter reference='injishi-*' --filter reference='ghcr.io/*/injishi-api'
      ;;
  esac
  exit 0
}

backup() {
  # The run's own success is the record: injishi-deploy-production reads the
  # newest successful injishi-backup build and refuses when it is too old.
  # Tool chain fixed by ADR-052: pg_dump -Fc, a tar of minio-data, age, rclone.
  if [ -r "$SETTINGS" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$SETTINGS"
    set +a
  fi

  echo "==> Check the settings are present before touching anything"
  local missing="" name tool
  for name in BACKUP_DESTINATION BACKUP_ENCRYPTION_RECIPIENT BACKUP_RETENTION_DAYS; do
    if [ -z "$(printenv "$name" || true)" ]; then missing="$missing $name"; fi
  done
  if [ -n "$missing" ]; then
    echo "ERROR: Missing on the host:$missing. Set them in $SETTINGS; see ADR-052 'Configuration required'."
    exit 1
  fi
  for tool in pg_dump age rclone tar; do
    command -v "$tool" >/dev/null || { echo "ERROR: $tool is not installed on the VPS."; exit 1; }
  done
  echo "settings and tools present"

  echo "==> Dump the database and the objects"
  work="$(mktemp -d)"
  trap 'rm -rf "$work" || true' EXIT
  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  compose() {
    docker compose -p injishi -f /opt/injishi/src/infra/docker/docker-compose.dokploy.yml \
      --env-file /opt/injishi/.env "$@"
  }
  # Custom format (-Fc), so a restore can use pg_restore and pick what it needs.
  compose exec -T db pg_dump -Fc -U injishi injishi > "$work/injishi-$stamp.dump"
  # The objects, straight off the volume. A database restored without them
  # points at uploads that are not there.
  docker run --rm \
    -v injishi_minio-data:/data:ro \
    -v "$work":/out \
    alpine:3 tar -czf "/out/minio-$stamp.tar.gz" -C /data .
  ls -lh "$work"

  echo "==> Encrypt"
  # To a recipient (a public key), so this host can WRITE a backup it cannot read.
  local file
  for file in "$work/injishi-$stamp.dump" "$work/minio-$stamp.tar.gz"; do
    age --recipient "$BACKUP_ENCRYPTION_RECIPIENT" --output "$file.age" "$file"
    rm -f "$file"
  done
  ls -lh "$work"

  echo "==> Ship to the second in country location"
  rclone copy "$work" "$BACKUP_DESTINATION/$(date -u +%Y/%m)" --no-traverse --progress

  echo "==> Confirm what landed"
  # A backup job that reports success without checking the far end is a backup
  # job that reports success forever.
  local remote size
  remote="$BACKUP_DESTINATION/$(date -u +%Y/%m)"
  for name in "injishi-$stamp.dump.age" "minio-$stamp.tar.gz.age"; do
    size="$(rclone size "$remote/$name" --json | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')"
    if [ -z "$size" ] || [ "$size" -lt 1024 ]; then
      echo "ERROR: $name is missing or implausibly small at the destination."
      exit 1
    fi
    echo "$name: $size bytes"
  done

  echo "==> Prune by retention"
  rclone delete "$BACKUP_DESTINATION" --min-age "${BACKUP_RETENTION_DAYS}d" --rmdirs
  echo "pruned copies older than ${BACKUP_RETENTION_DAYS} days"
}

schema_dump() {
  # From INSIDE the running db container, so no database credential is needed.
  # --schema-only keeps rows out; --no-owner and --no-privileges keep the dump
  # restorable into a throwaway CI database.
  exec docker compose -p injishi -f /opt/injishi/src/infra/docker/docker-compose.dokploy.yml \
    --env-file /opt/injishi/.env \
    exec -T db pg_dump --schema-only --no-owner --no-privileges -U injishi injishi
}

sha='[0-9a-f]{7,40}'
secs='[0-9]{1,6}'
if [[ $cmd =~ ^deploy\ (staging|production)\ ($sha)\ ($secs)\ ($secs)$ ]]; then
  deploy "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}" "${BASH_REMATCH[4]}"
elif [[ $cmd =~ ^serving\ (staging|production)$ ]]; then
  serving "${BASH_REMATCH[1]}"
elif [[ $cmd == backup ]]; then
  backup
elif [[ $cmd == schema-dump ]]; then
  schema_dump
else
  echo "denied: '$cmd'" >&2
  exit 2
fi

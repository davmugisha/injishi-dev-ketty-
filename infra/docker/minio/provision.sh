#!/bin/sh
# Provisions MinIO for the API, idempotently, on every `up`.
#
# Run by the one shot minio-init service (minio's own server image, entrypoint
# ["/bin/sh", "/provision.sh"]) before the API or a worker may start. That
# image is ubi9-micro plus /usr/bin/minio and /usr/bin/mc: a shell and
# coreutils, no curl, wget or jq, and no promise of grep or sed. So this is POSIX sh, mc and coreutils,
# and every parse below is a `case` pattern for that reason.
#
# What it leaves behind, whatever state it finds:
#
#   - STORAGE_BUCKET exists and is private: no bucket policy at all, so no
#     anonymous access. A browser reads an object only through a URL the API
#     signed. One bucket per stack: the demo is its own stack with its own
#     MinIO (ADR-043), so there is no demo bucket beside production's.
#   - With STORAGE_ENCRYPT=on (the default) each bucket carries SSE-S3 default
#     encryption. It needs the server's KMS key; a server without one refuses,
#     and so does this script, rather than leave production data in the clear.
#     `off` exists for a MinIO with no KMS key. It sets nothing and removes
#     nothing: an encrypted bucket is never downgraded by a re-run.
#   - The API's own user, STORAGE_S3_ACCESS_KEY, whose one policy
#     (`injishi-api`) allows object read, write and delete, and bucket list,
#     location and encryption read, on exactly these buckets. No bucket
#     creation, no policy changes, no admin API. Root never leaves this script.
#
# A re-run rewrites the policy from the current bucket, so a demo bucket an
# older version of this script provisioned beside production's drops out of
# the grant; the bucket itself and its objects are left alone. Data is never
# deleted here.
#
# Secrets never reach argv or the log. mc takes both keys on stdin, which it
# reads when they are left off the command line, and anything mc prints is
# redacted before this script repeats it. Never pass --json to `admin user
# add`: it echoes the secret back, which is why MC_JSON is unset below.
set -eu

POLICY=injishi-api
ALIAS=injishi
READY_TIMEOUT=60

fail() {
  printf 'provision: error: %s\n' "$*" >&2
  exit 1
}

# Replaces every occurrence of either secret in $1. POSIX has no global
# substitution and the image has no sed, so it walks the string by hand.
redact() {
  _text=$1
  for _secret in "${MINIO_ROOT_PASSWORD:-}" "${STORAGE_S3_SECRET_KEY:-}"; do
    [ -n "$_secret" ] || continue
    _done=
    while :; do
      case $_text in
        *"$_secret"*)
          _done=$_done${_text%%"$_secret"*}[redacted]
          _text=${_text#*"$_secret"}
          ;;
        *) break ;;
      esac
    done
    _text=$_done$_text
  done
  printf '%s' "$_text"
}

# Runs one mc step and stays silent unless it fails, so a clean run logs only
# the summary line.
step() {
  _what=$1
  shift
  if ! _out=$(mc --no-color "$@" 2>&1); then
    fail "$_what: $(redact "$_out")"
  fi
}

# Everything is checked before the server is touched, so a misconfigured
# deploy fails in one line naming every gap instead of half provisioning.
# Empty counts as missing: compose substitutes an unset ${VAR} with "".
missing=
for name in MINIO_ENDPOINT MINIO_ROOT_USER MINIO_ROOT_PASSWORD STORAGE_BUCKET STORAGE_S3_ACCESS_KEY STORAGE_S3_SECRET_KEY; do
  eval "value=\${$name:-}"
  [ -n "$value" ] || missing="$missing $name"
done
value=
[ -z "$missing" ] || fail "missing required variables:$missing"

# The env templates ship every secret as the placeholder change-me, and root
# answers on the public storage host, so a forgotten one must stop the deploy.
# The message names the variable and never repeats what it holds.
placeholder=
[ "$MINIO_ROOT_PASSWORD" != change-me ] || placeholder="$placeholder MINIO_ROOT_PASSWORD"
[ "$STORAGE_S3_SECRET_KEY" != change-me ] || placeholder="$placeholder STORAGE_S3_SECRET_KEY"
[ -z "$placeholder" ] || fail "still set to the template placeholder, replace with a real secret:$placeholder"

encrypt=${STORAGE_ENCRYPT:-on}
case $encrypt in
  on | off) ;;
  *) fail "STORAGE_ENCRYPT must be on or off, not '$encrypt'" ;;
esac

# Bucket names go into the policy JSON and into word-split loops, so only the
# characters S3 allows in a name are accepted (length and placement are left
# to the server). Spelled out rather than a-z: a range follows the locale.
valid_bucket() {
  case $2 in
    *[!abcdefghijklmnopqrstuvwxyz0123456789.-]*) fail "$1 is not a valid bucket name: '$2'" ;;
  esac
}
valid_bucket STORAGE_BUCKET "$STORAGE_BUCKET"
buckets=$STORAGE_BUCKET

# Handing the API root is exactly what this script exists to prevent.
[ "$STORAGE_S3_ACCESS_KEY" != "$MINIO_ROOT_USER" ] ||
  fail "STORAGE_S3_ACCESS_KEY must differ from MINIO_ROOT_USER; the API never holds root"

# The two binaries this depends on beyond the shell. Both ship in minio's
# server image (mc, and timeout from coreutils); anywhere else, say so up front.
for tool in mc timeout; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool is not on PATH; run this in minio's server image"
done

# mc keeps root's keys in its config file. Give it a private directory that
# goes with the script, so an exited container kept by compose does not hold
# them. The policy file lives there too.
umask 077
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
export MC_CONFIG_DIR="$workdir/mc"
unset MC_JSON MC_DEBUG "MC_HOST_$ALIAS"
# mc announces a fresh config directory on its first call. Spend that call on
# something discarded, so a real error below is not buried under the notice.
mc --no-color alias list >/dev/null 2>&1 || :

# --api skips mc's signature probe, which needs the server up; it may not be yet.
if ! _out=$(printf '%s\n%s\n' "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" |
  mc --no-color alias set --api S3v4 --path on "$ALIAS" "$MINIO_ENDPOINT" 2>&1); then
  fail "could not configure mc for $MINIO_ENDPOINT: $(redact "$_out")"
fi

# `mc ready` retries forever while the server is unreachable, so coreutils'
# timeout bounds it. A shell watchdog (background job, kill -0, sleep) was
# tried first and dropped: it leans on how each shell reaps a finished job,
# and it stalled under the Git Bash the verification harness runs it with.
ready=0
timeout "$READY_TIMEOUT" mc --no-color ready "$ALIAS" >"$workdir/ready.log" 2>&1 || ready=$?
case $ready in
  0) ;;
  124) fail "MinIO at $MINIO_ENDPOINT was not ready after ${READY_TIMEOUT}s: $(redact "$(tail -n 1 "$workdir/ready.log")")" ;;
  *) fail "could not reach MinIO at $MINIO_ENDPOINT: $(redact "$(tail -n 1 "$workdir/ready.log")")" ;;
esac

# An empty bucket policy first, then `private`. `anonymous set private` alone
# only strips grants on the bucket's root prefix and leaves one on, say,
# bucket/public* in place (mc then reports `custom`); the empty policy clears
# every statement, and `private` then deletes the empty document.
printf '{"Version":"2012-10-17","Statement":[]}' >"$workdir/no-policy.json"

for bucket in $buckets; do
  target="$ALIAS/$bucket"
  step "could not create bucket $bucket" mb --ignore-existing "$target"
  step "could not clear the bucket policy on $bucket" anonymous set-json "$workdir/no-policy.json" "$target"
  step "could not make $bucket private" anonymous set private "$target"
  step "could not read access on $bucket" anonymous get "$target"
  case $_out in
    *'`private`'*) ;;
    *) fail "$bucket is not private after provisioning: $(redact "$_out")" ;;
  esac

  if [ "$encrypt" = on ]; then
    # Fails on a server with no KMS key ("KMS is not configured"): that server
    # cannot encrypt, and a deploy asking for encryption must not come up on it.
    step "could not set SSE-S3 default encryption on $bucket (does the server have MINIO_KMS_SECRET_KEY?)" \
      encrypt set sse-s3 "$target"
    step "could not read the encryption config of $bucket" encrypt info "$target"
    case $_out in
      *"'sse-s3'"*) ;;
      *) fail "$bucket does not report SSE-S3 after provisioning: $(redact "$_out")" ;;
    esac
  fi
done

# Exactly what the storage adapter calls: put, get (a signed GET is the API's
# own GetObject), head (GetObject again) and delete on objects; HeadBucket
# (ListBucket), the region and the encryption config it checks at boot on the
# bucket. Nothing else, and only these buckets.
objects=
bucket_arns=
listed=
for bucket in $buckets; do
  objects="$objects${objects:+,}\"arn:aws:s3:::$bucket/*\""
  bucket_arns="$bucket_arns${bucket_arns:+,}\"arn:aws:s3:::$bucket\""
  listed="$listed${listed:+,}$bucket"
done
policy_file="$workdir/$POLICY.json"
cat >"$policy_file" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": [$objects]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation", "s3:GetEncryptionConfiguration"],
      "Resource": [$bucket_arns]
    }
  ]
}
EOF
# `create` replaces a policy of the same name in place, which is what makes a
# re-run with a different bucket list converge rather than accumulate.
step "could not write policy $POLICY" admin policy create "$ALIAS" "$POLICY" "$policy_file"

# `add` on an existing user sets the secret and re-enables it, so a rotated
# STORAGE_S3_SECRET_KEY takes effect on the next run. Its policy mapping stays.
if ! _out=$(printf '%s\n' "$STORAGE_S3_SECRET_KEY" |
  mc --no-color admin user add "$ALIAS" "$STORAGE_S3_ACCESS_KEY" 2>&1); then
  fail "could not create or update user $STORAGE_S3_ACCESS_KEY: $(redact "$_out")"
fi

# Sets $held to the user's attached policies as MinIO lists them ("a,b"), or
# to nothing when it has none (the key is then absent from the JSON).
read_user() {
  step "could not read user $STORAGE_S3_ACCESS_KEY" admin user info --json "$ALIAS" "$STORAGE_S3_ACCESS_KEY"
  held=
  case $_out in
    *'"policyName":"'*)
      held=${_out#*'"policyName":"'}
      held=${held%%'"'*}
      ;;
  esac
}

# Attach only when the policy is not already among the user's. "Already
# attached" is judged from the server's own record, not from the wording of an
# error, which has changed between MinIO releases; every attach error is fatal.
read_user
case ",$held," in
  *",$POLICY,"*) ;;
  *)
    step "could not attach $POLICY to $STORAGE_S3_ACCESS_KEY" admin policy attach "$ALIAS" "$POLICY" --user "$STORAGE_S3_ACCESS_KEY"
    read_user
    ;;
esac

# The user must hold this policy and nothing more. A policy attached by hand,
# or a group (which carries policies of its own), would widen the API's
# credential past what C8 allows, so the script refuses instead of starting
# the API on it. It does not detach: someone put that there, and should see why
# it is refused.
[ "$held" = "$POLICY" ] ||
  fail "user $STORAGE_S3_ACCESS_KEY holds policies '$held'; it must hold only $POLICY, detach the others"
case $_out in
  *'"memberOf":[{'*) fail "user $STORAGE_S3_ACCESS_KEY belongs to a group; groups carry policies, so remove it from every group" ;;
esac
case $_out in
  *'"userStatus":"enabled"'*) ;;
  *) fail "user $STORAGE_S3_ACCESS_KEY is not enabled after provisioning" ;;
esac

printf 'provision: ok buckets=%s encryption=%s user=%s policy=%s\n' \
  "$listed" "$encrypt" "$STORAGE_S3_ACCESS_KEY" "$POLICY"

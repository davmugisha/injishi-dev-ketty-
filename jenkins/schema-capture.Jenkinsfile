// Job injishi-schema-capture (pipeline, reads main). Ported from
// .github/workflows/schema-capture.yml. ADR-052 AC-8's other half.
//
// Publish production's schema, ROWS EXCLUDED, so a pull request's
// `integration: replay migrations on production's schema` stage can replay its
// migrations against the shape they will really meet. It travels as a tiny
// image with one file in it, ghcr.io/hangaasoftwares/injishi-schema, in the
// same private registry as the API image and nowhere else.
//
// The dump runs on the VPS, from inside the running db container, through the
// forced command of the VPS key (jenkins/vps/injishi-ci-gate.sh, verb
// `schema-dump`), so neither Jenkins nor the VPS needs a database credential.
// Jenkins checks it and publishes it, so the VPS needs no registry credential.
// The file lives in a temporary folder on the agent and is deleted afterwards.
//
// NOT RUNNABLE AS THINGS STAND: it dumps the hand-run stack at /opt/injishi,
// which does not exist (Dokploy runs production; infra/docker/DOKPLOY.md).
// Until it succeeds once, the replay stage says so and passes.
//
// Concurrency, as `concurrency: schema-capture, cancel-in-progress: false`, and
// one VPS job at a time across every injishi job (lock injishi-vps).

pipeline {
  agent none

  triggers {
    // 02:30 UTC (the controller's time zone is UTC), as the workflow's schedule.
    cron('30 2 * * *')
  }

  options {
    ansiColor('xterm')
  }

  environment {
    SCHEMA_IMAGE = 'ghcr.io/hangaasoftwares/injishi-schema'
    VPS_HOST = '102.202.208.167'
    VPS_PORT = '222'
    VPS_HOST_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIHhdrxHr36eH8oFnjZ+MoHgScXQJcKtW9FAT8MzZffu'
  }

  stages {
    stage('capture and publish') {
      steps {
        script {
          milestone(ordinal: 1)
          lock(resource: 'injishi-schema-capture', inversePrecedence: true) {
            milestone(ordinal: 2)
            lock('injishi-vps') {
              node('docker') {
                timeout(time: 20, unit: 'MINUTES') {
                  def work = sh(returnStdout: true, script: 'mktemp -d').trim()
                  try {
                    withEnv(["WORK=${work}"]) {
                      echo 'Dump the schema'
                      vps('schema-dump', false, "${work}/schema.sql")
                      sh '''#!/bin/bash
set -euo pipefail
if ! grep -q "CREATE TABLE" "$WORK/schema.sql"; then
  echo "ERROR: The dump contains no CREATE TABLE. Refusing to publish a schema that would make the replay stage pass by checking nothing."
  exit 1
fi
wc -l "$WORK/schema.sql"

printf '\\n==> Refuse to publish anything that looks like a row\\n'
# --schema-only should make this impossible. It is checked anyway, because the
# cost of being wrong is publishing personal data to a registry.
if grep -qE '^(COPY |INSERT INTO )' "$WORK/schema.sql"; then
  echo "ERROR: The dump contains row data. Not publishing."
  exit 1
fi
echo "No COPY or INSERT statements: schema only, as intended."
'''
                      withCredentials([usernamePassword(credentialsId: 'injishi-ghcr', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_TOKEN')]) {
                        sh '''#!/bin/bash
set -euo pipefail
printf '\\n==> Publish it to GHCR\\n'
cd "$WORK"
printf 'FROM scratch\\nCOPY schema.sql /schema.sql\\n' > Dockerfile
DOCKER_CONFIG="$(mktemp -d)"
export DOCKER_CONFIG
trap 'docker logout ghcr.io >/dev/null 2>&1 || true; rm -rf "$DOCKER_CONFIG"' EXIT
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin
day="$(date -u +%Y%m%d)"
docker build -t "$SCHEMA_IMAGE:latest" -t "$SCHEMA_IMAGE:$day" .
docker push "$SCHEMA_IMAGE:latest"
docker push "$SCHEMA_IMAGE:$day"
docker image rm "$SCHEMA_IMAGE:$day" >/dev/null 2>&1 || true
'''
                      }
                    }
                  } finally {
                    sh "rm -rf '${work}' || true"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

// One verb of the VPS gate, its output streamed here (or written to `stdoutFile`).
// The key can do nothing else (jenkins/vps/injishi-ci-gate.sh).
def vps(String verb, boolean mayFail = false, String stdoutFile = '') {
  def status = 0
  withCredentials([sshUserPrivateKey(credentialsId: 'injishi-vps-ssh', keyFileVariable: 'VPS_KEY', usernameVariable: 'VPS_USER')]) {
    withEnv(["VPS_VERB=${verb}", "VPS_STDOUT=${stdoutFile}"]) {
      status = sh(returnStatus: mayFail, script: '''#!/bin/bash
set -euo pipefail
known_hosts="$(mktemp)"
trap 'rm -f "$known_hosts"' EXIT
printf '[%s]:%s %s\\n' "$VPS_HOST" "$VPS_PORT" "$VPS_HOST_KEY" > "$known_hosts"
if [ -n "${VPS_STDOUT:-}" ]; then exec > "$VPS_STDOUT"; fi
ssh -i "$VPS_KEY" -p "$VPS_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ServerAliveInterval=30 -o ServerAliveCountMax=10 -o LogLevel=ERROR "$VPS_USER@$VPS_HOST" "$VPS_VERB"
''')
    }
  }
  return status
}

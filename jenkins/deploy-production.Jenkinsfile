// Job injishi-deploy-production (pipeline, reads main). Ported from
// .github/workflows/deploy-production.yml. ADR-052 AC-13 to AC-16.
//
// Production changes only when a person decides it should: this job has NO
// trigger. Nothing starts it but Build with Parameters, naming the commit.
//
// Two gates stand in front of it, and both are read from Jenkins' own build
// history (the REST API, credential injishi-jenkins-api), never from a file on
// the host: a marker file is written by the thing it vouches for and can be
// raced or edited; a build's own success cannot.
//
//   AC-14  The newest successful injishi-deploy-staging build must have deployed
//          THIS commit (its COMMIT parameter). You promote what staging is
//          running, not what it once ran.
//   AC-15  The newest successful injishi-backup build must have finished within
//          BACKUP_MAX_AGE_HOURS. A stalled backup blocks a release, which is the
//          correct direction to fail in.
//
// NOT RUNNABLE AS THINGS STAND: the deploy runs deploy-stack.sh in
// /opt/injishi/src on the VPS, and that hand-run stack does not exist; Dokploy
// deploys production itself, from main (infra/docker/DOKPLOY.md). The gates
// refuse every commit until injishi-deploy-staging and injishi-backup have
// succeeded. Ported unchanged, as it was left in Actions.
//
// Concurrency, as `concurrency: deploy-production, cancel-in-progress: false`:
// one at a time, never aborted once started, of those waiting only the newest
// runs; and one VPS job at a time across every injishi job (lock injishi-vps).

pipeline {
  agent none

  options {
    ansiColor('xterm')
  }

  parameters {
    string(name: 'COMMIT', defaultValue: '', trim: true, description: 'The commit to deploy. Must be the one staging is running.')
  }

  environment {
    // GitHub repository variables (none set): their defaults.
    BACKUP_MAX_AGE_HOURS = '26'
    DEPLOY_HEALTH_TIMEOUT = '600'
    DEPLOY_LOCK_TIMEOUT = '1800'
    // Where the gates read the history. The agent shares the host's network, and
    // the controller publishes 8080 on 127.0.0.1.
    JENKINS_LOCAL_URL = 'http://127.0.0.1:8080'
    STAGING_JOB = 'job/injishi-deploy-staging'
    BACKUP_JOB = 'job/injishi-backup'
    VPS_HOST = '102.202.208.167'
    VPS_PORT = '222'
    VPS_HOST_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIHhdrxHr36eH8oFnjZ+MoHgScXQJcKtW9FAT8MzZffu'
  }

  stages {
    stage('wait for the deploy-production slot') {
      steps {
        milestone(ordinal: 1)
      }
    }

    stage('production') {
      options {
        lock(resource: 'injishi-deploy-production', inversePrecedence: true)
      }
      stages {
        stage('backup and staging gates') {
          steps {
            milestone(ordinal: 2)
            script {
              node('docker') {
                timeout(time: 10, unit: 'MINUTES') {
                  withCredentials([usernamePassword(credentialsId: 'injishi-jenkins-api', usernameVariable: 'JENKINS_API_USER', passwordVariable: 'JENKINS_API_TOKEN')]) {
                    sh '''#!/bin/bash
set -euo pipefail
requested="$(printf '%s' "${COMMIT:-}" | tr -d '[:space:]')"
if ! [[ $requested =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "ERROR: '$requested' is not a git sha."
  exit 1
fi

# GET a Jenkins API path. Prints the body on 200, returns 4 on 404 (no such
# build), 1 on anything else. The token goes to curl on stdin, never argv.
jenkins_get() {
  local body status
  body="$(mktemp)"
  status="$(printf 'user = "%s:%s"\\n' "$JENKINS_API_USER" "$JENKINS_API_TOKEN" |
    curl -sS --globoff --config - --output "$body" --write-out '%{http_code}' "$JENKINS_LOCAL_URL/$1")" || status=000
  case "$status" in
    200) cat "$body"; rm -f "$body"; return 0 ;;
    404) rm -f "$body"; return 4 ;;
    *) echo "ERROR: the Jenkins API answered HTTP $status for /$1. Check the injishi-jenkins-api credential." >&2; rm -f "$body"; return 1 ;;
  esac
}

# ── AC-15, the backup gate ──────────────────────────────────────────────────
rc=0
backup="$(jenkins_get "$BACKUP_JOB/lastSuccessfulBuild/api/json?tree=number,timestamp,duration")" || rc=$?
if [ "$rc" -eq 4 ]; then
  echo "ERROR: No successful injishi-backup build exists. Production is not recoverable, so it is not something to change automatically. Run injishi-backup first."
  exit 1
fi
[ "$rc" -eq 0 ] || exit 1
number="$(jq -r '.number' <<<"$backup")"
finished_ms="$(jq -r '.timestamp + .duration' <<<"$backup")"
now_ms="$(date +%s%3N)"
age="$(awk -v now="$now_ms" -v done="$finished_ms" 'BEGIN { printf "%.1f", (now - done) / 3600000 }')"
echo "Newest successful backup: build #$number, ${age}h old."
if awk -v now="$now_ms" -v done="$finished_ms" -v max="$BACKUP_MAX_AGE_HOURS" 'BEGIN { exit !((now - done) / 3600000 > max) }'; then
  echo "ERROR: The newest successful backup is ${age}h old, and BACKUP_MAX_AGE_HOURS is $BACKUP_MAX_AGE_HOURS. Refusing before anything changed. Find out why the backup stopped rather than raising the limit."
  exit 1
fi

# ── AC-14, the staging gate ─────────────────────────────────────────────────
rc=0
staging="$(jenkins_get "$STAGING_JOB/lastSuccessfulBuild/api/json?tree=number,actions[parameters[name,value]]")" || rc=$?
if [ "$rc" -eq 4 ]; then
  echo "ERROR: No successful injishi-deploy-staging build exists, so no commit has been run anywhere."
  exit 1
fi
[ "$rc" -eq 0 ] || exit 1
number="$(jq -r '.number' <<<"$staging")"
deployed="$(jq -r '[.actions[]? | .parameters[]? | select(.name == "COMMIT") | .value][0] // ""' <<<"$staging" | tr -d '[:space:]')"
echo "Newest successful staging deploy: build #$number, commit ${deployed:-none}."
if [ -z "$deployed" ] || { [[ $deployed != "$requested"* ]] && [[ $requested != "$deployed"* ]]; }; then
  echo "ERROR: Staging is running ${deployed:-nothing recorded}, not $requested. Refusing before anything changed. Production is promoted from what staging IS running, not from what it once ran: merge to main, let staging deploy, then run this with that sha."
  exit 1
fi

echo "Both gates pass."
'''
                  }
                }
              }
            }
          }
        }

        stage('deploy production') {
          steps {
            script {
              lock('injishi-vps') {
                node('docker') {
                  timeout(time: 120, unit: 'MINUTES') {
                    try {
                      echo 'Deploy, and roll back if it does not come up healthy'
                      vps("deploy production ${params.COMMIT} ${env.DEPLOY_HEALTH_TIMEOUT} ${env.DEPLOY_LOCK_TIMEOUT}")
                    } finally {
                      echo 'What is serving now'
                      vps('serving production', true)
                    }
                  }
                }
              }
            }
          }
          post {
            failure {
              echo '''WARNING: A rollback restores IMAGES ONLY. Any migration this release applied is
WARNING: still applied, so the restored image is running against a newer schema
WARNING: than it shipped with. Check the release's migrations before deciding
WARNING: whether the rollback is actually sufficient.'''
            }
          }
        }
      }
    }
  }
}

// One verb of the VPS gate, its output streamed here. The key can do nothing
// else (jenkins/vps/injishi-ci-gate.sh).
def vps(String verb, boolean mayFail = false) {
  def status = 0
  withCredentials([sshUserPrivateKey(credentialsId: 'injishi-vps-ssh', keyFileVariable: 'VPS_KEY', usernameVariable: 'VPS_USER')]) {
    withEnv(["VPS_VERB=${verb}"]) {
      status = sh(returnStatus: mayFail, script: '''#!/bin/bash
set -euo pipefail
known_hosts="$(mktemp)"
trap 'rm -f "$known_hosts"' EXIT
printf '[%s]:%s %s\\n' "$VPS_HOST" "$VPS_PORT" "$VPS_HOST_KEY" > "$known_hosts"
ssh -i "$VPS_KEY" -p "$VPS_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ServerAliveInterval=30 -o ServerAliveCountMax=10 -o LogLevel=ERROR "$VPS_USER@$VPS_HOST" "$VPS_VERB"
''')
    }
  }
  return status
}

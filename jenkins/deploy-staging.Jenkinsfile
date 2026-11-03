// Job injishi-deploy-staging (pipeline, reads main). Ported from
// .github/workflows/deploy-staging.yml. ADR-052 AC-11, AC-12, AC-13, AC-18.
//
// Every green commit on main reaches staging with no human step, because
// staging is the thing production is promoted FROM. The `injishi` build of main
// starts this job with COMMIT = its commit once the API image is in GHCR (what
// `workflow_run: [image]` did). Run it by hand, Build with Parameters, to deploy
// a named commit (what workflow_dispatch did, AC-13); that commit must already
// have an API image in GHCR.
//
// Its own job rather than a stage of the main build, on purpose:
// injishi-deploy-production's gate asks "did the newest SUCCESSFUL staging
// deploy deploy this commit?", and reads the answer from this job's history
// (its COMMIT parameter). A stage inside the main build would tie that record
// to ci and integration results that say nothing about staging.
//
// No checkout. The deploy runs ON the VPS, in the stack's own tree
// (/opt/injishi-staging/src), through the forced command of the VPS key
// (jenkins/vps/injishi-ci-gate.sh), so the deploy script that runs is the one
// in the commit being deployed.
//
// Concurrency, as `concurrency: deploy-staging, cancel-in-progress: false`:
// one deploy at a time, never aborted once it started (a half finished deploy
// leaves the stack in a state nobody chose), and of the deploys waiting only
// the newest runs. And, as the one self hosted runner did, one VPS job at a
// time across every injishi job (lock injishi-vps).

pipeline {
  agent none

  options {
    ansiColor('xterm')
  }

  parameters {
    string(name: 'COMMIT', defaultValue: '', trim: true, description: 'The commit to deploy. Must already have an API image in GHCR.')
  }

  environment {
    // GitHub repository variables (none set): their defaults.
    DEPLOY_HEALTH_TIMEOUT = '600'
    DEPLOY_LOCK_TIMEOUT = '1800'
    VPS_HOST = '102.202.208.167'
    VPS_PORT = '222'
    VPS_HOST_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIHhdrxHr36eH8oFnjZ+MoHgScXQJcKtW9FAT8MzZffu'
  }

  stages {
    stage('deploy staging') {
      steps {
        script {
          milestone(ordinal: 1)
          lock(resource: 'injishi-deploy-staging', inversePrecedence: true) {
            milestone(ordinal: 2)
            lock('injishi-vps') {
              node('docker') {
                timeout(time: 90, unit: 'MINUTES') {
                  try {
                    sh '''#!/bin/bash
set -euo pipefail
commit="${COMMIT:-}"
case "$commit" in
  *[!0-9a-f]* | "") echo "ERROR: '$commit' is not a git sha."; exit 1 ;;
esac
echo "Deploying $commit to staging"
'''
                    vps("deploy staging ${params.COMMIT} ${env.DEPLOY_HEALTH_TIMEOUT} ${env.DEPLOY_LOCK_TIMEOUT}")
                  } finally {
                    echo 'What is serving now'
                    vps('serving staging', true)
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

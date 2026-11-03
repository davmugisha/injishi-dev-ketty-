// Job injishi-backup (pipeline, reads main). Ported from
// .github/workflows/backup.yml. ADR-052 AC-19.
//
// Production gets backups, because making it cheaper to change a system you
// cannot restore is the wrong order to do things in.
//
// THE BUILD'S OWN SUCCESS IS THE RECORD. injishi-deploy-production reads the
// newest successful build of this job from Jenkins and refuses to deploy when it
// finished more than BACKUP_MAX_AGE_HOURS ago. Nothing writes a marker file.
// So a backup that quietly stops working blocks releases, which is the correct
// direction to fail in.
//
// Every step runs on the VPS, through the forced command of the VPS key
// (jenkins/vps/injishi-ci-gate.sh, verb `backup`): pg_dump in custom format, a
// tar of the minio-data volume, age to encrypt, rclone to ship, a check of what
// landed, retention pruning. The settings (BACKUP_DESTINATION,
// BACKUP_ENCRYPTION_RECIPIENT, BACKUP_RETENTION_DAYS) live on the VPS, never in
// Jenkins. Restore steps: infra/docker/DOKPLOY.md, "Restoring from a backup".
//
// Compliance: production holds personal data under Rwanda's Law 058/2021; a
// backup carries the same constraint, which is why BACKUP_DESTINATION must be in
// country.
//
// Concurrency, as `concurrency: backup, cancel-in-progress: false`, and one VPS
// job at a time across every injishi job (lock injishi-vps).

pipeline {
  agent none

  triggers {
    // 00:15 UTC (the controller's time zone is UTC), as the workflow's schedule.
    cron('15 0 * * *')
  }

  options {
    ansiColor('xterm')
  }

  environment {
    VPS_HOST = '102.202.208.167'
    VPS_PORT = '222'
    VPS_HOST_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIHhdrxHr36eH8oFnjZ+MoHgScXQJcKtW9FAT8MzZffu'
  }

  stages {
    stage('back production up') {
      steps {
        script {
          milestone(ordinal: 1)
          lock(resource: 'injishi-backup', inversePrecedence: true) {
            milestone(ordinal: 2)
            lock('injishi-vps') {
              node('docker') {
                timeout(time: 120, unit: 'MINUTES') {
                  vps('backup')
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

// Job injishi-pr-rules (pipeline, reads main). ADR-078 AC-11 to AC-15, in
// injishi.context's dox/adrs/078-delivery-guardrails.
//
// Every 5 minutes, and whenever someone presses Build Now, this judges every
// open pull request on hangaasoftwares/injishi, whatever its base, and posts two
// commit statuses on each head commit: injishi/pr-rules (the delivery rules) and
// injishi/review (an approval of the current head by someone other than the
// author). scripts/check-pr-rules.mjs holds the rules; this file only runs it.
//
// It reads pull requests through the GitHub API and never checks out or runs a
// pull request's code, so it is the one place injishi-github-status may sit
// next to work a fork influenced: the token meets nothing but main's script and
// GitHub's JSON. A pull request that edits the script is judged by the version
// here, on main, until it merges.
//
// A run that cannot judge a pull request (an API error, a refused or expired
// token, a truncated file list) fails, so a broken token shows as a red job here
// rather than as statuses that silently stop changing (AC-14).
//
// Settings: the credential injishi-github-status (jenkins/CREDENTIALS.md). The
// Node version is mise.toml's, never retyped here.

pipeline {
  agent none

  triggers {
    // H spreads the minute so this does not start on the hour with every other job.
    cron('H/5 * * * *')
  }

  options {
    ansiColor('xterm')
    // Two runs at once would post the same statuses twice.
    disableConcurrentBuilds()
    timeout(time: 10, unit: 'MINUTES')
    // About a day of runs at one every 5 minutes.
    buildDiscarder(logRotator(numToKeepStr: '300'))
  }

  stages {
    stage('judge every open pull request') {
      steps {
        script {
          node('docker') {
            checkout scm
            withCredentials([string(credentialsId: 'injishi-github-status', variable: 'GITHUB_TOKEN')]) {
              sh '''#!/bin/bash
set -euo pipefail
node_version="$(sed -nE 's/^[[:space:]]*node[[:space:]]*=[[:space:]]*"([^"]*)".*/\\1/p' mise.toml | head -n1)"
if [ -z "$node_version" ]; then
  echo "ERROR: No node version pin found in mise.toml."
  exit 1
fi
# A bare Node image and only scripts/, read only: the rules need nothing else,
# and nothing in this workspace is a pull request's code anyway.
docker run --rm \\
  --env GITHUB_TOKEN --env BUILD_URL \\
  --volume "$PWD/scripts:/rules:ro" --workdir /rules \\
  "node:${node_version}-bookworm-slim" \\
  node check-pr-rules.mjs
'''
            }
          }
        }
      }
    }
  }
}

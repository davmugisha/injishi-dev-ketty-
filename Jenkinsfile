// CI for hangaasoftwares/injishi, and the start of the staging chain.
//
// Jenkins (https://deploy.shamis.app) replaces GitHub Actions for this
// repository. This file is the multibranch job `injishi`: every pull request
// against main (built merged with main), every push to main, and `mobile-v*`
// tags. ADR-052 still owns the design; the stages name the AC they carry.
//
//   .github/workflows/ci.yml             -> the `ci:` stages, ending in ci-complete
//   .github/workflows/image.yml          -> `image` (main, after a green ci)
//   .github/workflows/deploy-staging.yml -> `deploy-staging`: starts the job
//       (its workflow_run trigger)          injishi-deploy-staging with this commit
//   .github/workflows/integration.yml    -> the `integration:` stages
//   .github/workflows/mobile-release.yml -> `mobile-release` (mobile-v* tags only)
//   .github/actions/pnpm-setup           -> `prepare` and the toolchain image
//
// Properties this file keeps from the workflows:
//
// 1. A pull request runs THIS file from its own branch, so nothing here may
//    reach the VPS. VPS work lives in jenkins/*.Jenkinsfile, whose jobs read
//    main only, and `ci: workflow guard` fails the build if this file ever names
//    the VPS key (the Jenkins form of AC-17b; it has the same limit: a pull
//    request can edit the guard too, so write access stays the real boundary).
// 2. Every ci job runs in its own container with its own time limit, and a
//    failed job does not stop the next one. `ci-complete`
//    (scripts/ci-complete.mjs) is the verdict, and a skipped job is a pass.
//    The jobs run one after another in one workspace rather than side by side:
//    GitHub gave each its own 2 to 4 core runner, this is one 8 core host, and
//    web's and mobile's suites fail under CPU contention. The order keeps a job
//    from leaning on what another left behind: token drift is checked before
//    anything rebuilds dist/, typecheck runs before a Next build rewrites
//    next-env.d.ts, and mobile, which generates its typed routes, runs last.
// 3. image and staging hang off ci alone. integration fails the build but never
//    stops them; it was its own workflow and is not in ci-complete.
//
// Toolchain: Node from mise.toml and pnpm from `packageManager`, never retyped
// here (ADR-052 Value sourcing). `prepare` builds `injishi-ci-node:<node>-pnpm<pnpm>`
// on the host's Docker once per version pair; every job runs in it as the
// agent's user. pnpm's store is shared by all injishi builds on the agent
// (GitHub's `cache: pnpm`).

import groovy.transform.Field

// What each ci job concluded (for ci-complete), and which jobs
// scripts/ci-changes.mjs selected.
@Field Map ciResults = [:]
@Field Map ciFlags = [:]

pipeline {
  agent { label 'docker' }

  options {
    // ci.yml and integration.yml: a superseded pull request build is aborted; a
    // build of main is never aborted (staging hangs off it), it queues.
    disableConcurrentBuilds(abortPrevious: env.CHANGE_ID != null)
    // Each job has its own limit; this only catches a hang outside them, at
    // GitHub's own ceiling for a job.
    timeout(time: 6, unit: 'HOURS')
    ansiColor('xterm')
  }

  environment {
    CI = 'true'
    CACHE_ROOT = '/srv/jenkins-agent/caches/injishi'
    REGISTRY_OWNER = 'hangaasoftwares'
  }

  stages {
    stage('prepare') {
      steps {
        script { prepare() }
      }
    }

    // ── ci.yml ──────────────────────────────────────────────────────────────

    // AC-17b. Runs on every change, so the answer is on the record for every build.
    stage('ci: workflow guard') {
      when { expression { env.RUN_CI == 'true' } }
      steps {
        script {
          ciJob('workflow-guard', 5, '''
step 'No pull request may reach the deploy runner'
node scripts/check-workflow-triggers.mjs

step 'No pull request may reach the VPS key'
# A pull request runs the root Jenkinsfile from its own branch, so the root
# Jenkinsfile must never hold the VPS key. The id is assembled here so this
# line does not trip the check it makes; comment lines are ignored.
key="injishi-vps""-ssh"
if grep -nF "$key" Jenkinsfile | grep -vE '^[0-9]+:[[:space:]]*//'; then
  echo "ERROR: Jenkinsfile names the credential $key. A pull request runs this file from its own branch, so that would put unmerged branch code on the production VPS (ADR-052 AC-17). VPS work belongs in jenkins/*.Jenkinsfile, whose jobs read main."
  exit 1
fi
echo "ok  Jenkinsfile never names $key"
''')
        }
      }
    }

    // AC-1. Which of the jobs below have anything to do, computed from the
    // workspace dependency graph by scripts/ci-changes.mjs.
    stage('ci: changed paths') {
      when { expression { env.RUN_CI == 'true' } }
      steps {
        script {
          ciJob('changes', 5, '''
step 'Work out what changed'
# scripts/ci-changes.mjs writes its name=value answers to $GITHUB_OUTPUT.
export GITHUB_OUTPUT="$JOB_TMP/outputs"
: > "$GITHUB_OUTPUT"
# Jenkins drops a variable whose value is empty, so an unknown base arrives unset.
node scripts/ci-changes.mjs "${CI_BASE:-}" HEAD
''', [env: ["CI_BASE=${env.CI_BASE ?: ''}"]])
          if (ciResults['changes'] == 'success') {
            ciFlags = keyValues(readFile(file: "${env.CI_TMP}/changes/outputs"))
          }
        }
      }
    }

    // AC-4. Before anything rebuilds packages/design-tokens/dist.
    stage('ci: token drift') {
      when { expression { ciFlags['tokens'] == 'true' } }
      steps {
        script {
          ciJob('tokens', 10, installStep() + '''
step 'pnpm --filter @injishi/design-tokens check'
pnpm --filter @injishi/design-tokens check
''')
        }
      }
    }

    // AC-3. `pnpm -r lint` first, because its output is what you read when this
    // fails; the ratchet re-runs eslint with --format json to count warnings.
    stage('ci: lint') {
      when { expression { ciFlags['lint'] == 'true' } }
      steps {
        script {
          ciJob('lint', 20, installStep() + '''
step 'Lint the workspace'
pnpm -r lint

step 'Warning ratchet'
node scripts/lint-ratchet.mjs
''')
        }
      }
    }

    // AC-5. A NEW import cycle in the API fails; see .github/api-cycles-baseline.json.
    stage('ci: api import cycles') {
      when { expression { ciFlags['cycles'] == 'true' } }
      steps {
        script {
          ciJob('cycles', 10, installStep() + '''
step 'No new import cycle'
node scripts/api-cycles-ratchet.mjs
''')
        }
      }
    }

    // AC-2.
    stage('ci: typecheck') {
      when { expression { ciFlags['typecheck'] == 'true' } }
      steps {
        script {
          ciJob('typecheck', 20, installStep() + '''
step 'Every workspace member declares typecheck, lint and test'
node scripts/check-workspace-manifests.mjs

step 'Next tsconfigs list no scratch build types'
node scripts/check-tsconfig-includes.mjs
''' + compiledPackagesStep() + '''
step 'Typecheck the workspace'
pnpm -r typecheck
''')
        }
      }
    }

    // `pnpm test:ci`, not `pnpm -r test`: it pins --workspace-concurrency=1 and
    // leaves mobile's suite to the mobile job.
    stage('ci: unit tests') {
      when { expression { ciFlags['test_unit'] == 'true' } }
      steps {
        script {
          ciJob('test-unit', 20, installStep() + compiledPackagesStep() + '''
step 'Run every suite'
pnpm test:ci
''')
        }
      }
    }

    stage('ci: build api') {
      when { expression { ciFlags['build_api'] == 'true' } }
      steps {
        script {
          ciJob('build-api', 30, installStep() + compiledPackagesStep() + '''
step 'pnpm --filter @injishi/api build'
pnpm --filter @injishi/api build
''')
        }
      }
    }

    stage('ci: build web') {
      when { expression { ciFlags['build_web'] == 'true' } }
      steps {
        script {
          ciJob('build-web', 30, installStep() + compiledPackagesStep() + '''
step 'pnpm --filter @injishi/web build'
pnpm --filter @injishi/web build
''')
        }
      }
    }

    stage('ci: build app') {
      when { expression { ciFlags['build_app'] == 'true' } }
      steps {
        script {
          ciJob('build-app', 30, installStep() + compiledPackagesStep() + '''
step 'pnpm --filter @injishi/app build'
pnpm --filter @injishi/app build
''')
        }
      }
    }

    // Mobile spec 0001 (ADR-052 AC-6). check:ci is the whole mobile verdict; its
    // fingerprint verdict compares against the merge base with origin/main.
    stage('ci: mobile') {
      when { expression { ciFlags['mobile'] == 'true' } }
      steps {
        script {
          ciJob('mobile', 25, installStep() + '''
step 'check:ci'
pnpm --filter @injishi/mobile check:ci
''')
        }
      }
    }

    // AC-1. Always runs when ci does, and reports the one verdict: skipped is a
    // pass, failure is not.
    stage('ci: ci-complete') {
      when { expression { env.RUN_CI == 'true' } }
      steps {
        script {
          ciJob('ci-complete', 5, '''
step 'Report'
node scripts/ci-complete.mjs
''', [env: ["CI_NEEDS=${ciNeedsJson()}"]])
          env.CI_PASSED = (ciResults['ci-complete'] == 'success') ? 'true' : 'false'
        }
      }
    }

    // ── image.yml (AC-9) ────────────────────────────────────────────────────
    // The API image, once per green commit on main, to GHCR tagged with the
    // short sha, INJISHI_COMMIT set to the same value. Built from a clean tree,
    // as from a fresh checkout. Only the API: the frontends bake per stack values
    // and are built on the host (AC-10).
    stage('image: build and push the API image') {
      when {
        allOf {
          branch 'main'
          expression { env.CI_PASSED == 'true' }
        }
      }
      steps {
        script {
          ciJob('image', 40, '''
step 'Resolve the tag'
checked_out="$(git rev-parse HEAD)"
if [ "$checked_out" != "$GIT_COMMIT" ]; then
  echo "ERROR: Checked out $checked_out but this build is for $GIT_COMMIT."
  exit 1
fi
git reset --hard --quiet HEAD
git clean -ffdxq
short="$(git rev-parse --short HEAD)"
image="ghcr.io/$REGISTRY_OWNER/injishi-api:$short"
echo "Building $short"

step 'Sign in to GHCR'
DOCKER_CONFIG="$(mktemp -d)"
export DOCKER_CONFIG
trap 'docker logout ghcr.io >/dev/null 2>&1 || true; rm -rf "$DOCKER_CONFIG"' EXIT
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin

step 'Build and push'
# INJISHI_COMMIT is the ONE build argument this Dockerfile takes, and it must
# equal the tag: `docker inspect` on the image answers "which commit is this".
docker buildx build --file infra/docker/Dockerfile.api --build-arg "INJISHI_COMMIT=$short" --tag "$image" --push .
docker image rm "$image" >/dev/null 2>&1 || true
''', [container: false, heroui: false, creds: [usernamePassword(credentialsId: 'injishi-ghcr', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_TOKEN')]])
          env.IMAGE_PUSHED = (ciResults['image'] == 'success') ? 'true' : 'false'
        }
      }
    }

    // ── deploy-staging.yml's trigger (AC-11) ────────────────────────────────
    // Every green commit on main reaches staging with no human step. The deploy
    // is its own job (jenkins/deploy-staging.Jenkinsfile) so that production's
    // gate can read "the newest successful staging deploy" from its history, and
    // so a slow deploy neither holds this build nor colours its status.
    stage('deploy-staging') {
      when {
        allOf {
          branch 'main'
          expression { env.IMAGE_PUSHED == 'true' }
        }
      }
      steps {
        build job: '/injishi-deploy-staging', wait: false, parameters: [string(name: 'COMMIT', value: env.GIT_COMMIT)]
      }
    }

    // ── integration.yml (AC-7, AC-7b, AC-8) ─────────────────────────────────
    // On a pull request only when it touches server/api, packages/contracts,
    // packages/auth, pnpm-lock.yaml or this file; on main always.
    stage('integration: against a real database') {
      when { expression { env.RUN_INTEGRATION == 'true' } }
      steps {
        script {
          catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
            withServices('database', true) { String db ->
              ciJob('database', 30, installStep() + compiledPackagesStep() + '''
# AC-7, in this order, each exiting 0 or the job fails.
step 'Apply every migration'
pnpm --filter @injishi/api db:migrate

step 'Mark the database sample'
# Postgres accepts this marker only on a database with no users, so it cannot be
# written over anything real. Every seed refuses a database without it.
(cd server/api && node scripts/mark-sample-database.mjs --sample)

step 'Seed'
pnpm --filter @injishi/api db:seed

step 'verify:authz'
# The one verify script that needs no running API: it reads DATABASE_URL only.
pnpm --filter @injishi/api verify:authz

# AC-7b, the two HTTP clients.
step 'Build the API'
pnpm --filter @injishi/api build

step 'Start the API and wait for it to answer'
api_log="$JOB_TMP/api.log"
api_pid=""
the_api_log() {
  set +e
  if [ -f "$api_log" ]; then
    printf '\\n==> The API log\\n'
    tail -200 "$api_log"
  fi
  [ -n "$api_pid" ] && kill "$api_pid" 2>/dev/null
  true
}
trap the_api_log EXIT
(cd server/api && exec node dist/main.js) > "$api_log" 2>&1 &
api_pid=$!
# The verify scripts do NOT wait; without this they fail against an API that is
# merely not listening yet, which reads as a product failure and is not one.
ready=false
for attempt in $(seq 1 60); do
  if curl -fsS "$VERIFY_API_URL/api/v1/health" > /dev/null 2>&1; then
    echo "the API answered after ${attempt}s"
    curl -fsS "$VERIFY_API_URL/api/v1/health"
    echo
    ready=true
    break
  fi
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "ERROR: The API exited before it listened."
    exit 1
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  echo "ERROR: The API never answered GET /api/v1/health within 60s."
  exit 1
fi

step 'verify:ops-reads'
pnpm --filter @injishi/api verify:ops-reads

step 'verify:walk-in'
# Nothing seeds a guest_stays row: this creates one through POST
# /ops/stays/walk-in and checks the guest back out again.
pnpm --filter @injishi/api verify:walk-in
''', [args: "--network container:${db}", env: integrationEnv()])
            }
          }
        }
      }
    }

    // AC-8. Replays every migration on top of production's real schema, which
    // injishi-schema-capture publishes to GHCR. Missing, it warns and passes,
    // as the workflow did.
    stage("integration: replay migrations on production's schema") {
      when { expression { env.RUN_INTEGRATION == 'true' } }
      steps {
        script {
          catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
            withServices('replay', false) { String db ->
              def jobTmp = "${env.CI_TMP}/schema-replay"
              withEnv(["SVC_DB=${db}", "JOB_TMP=${jobTmp}", "SCHEMA_IMAGE=ghcr.io/${env.REGISTRY_OWNER}/injishi-schema:latest"]) {
                withCredentials([usernamePassword(credentialsId: 'injishi-ghcr', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_TOKEN')]) {
                  sh '''#!/bin/bash
set -euo pipefail
mkdir -p "$JOB_TMP"
echo false > "$JOB_TMP/available"
printf '\\n==> Sign in to GHCR\\n'
DOCKER_CONFIG="$(mktemp -d)"
export DOCKER_CONFIG
trap 'docker logout ghcr.io >/dev/null 2>&1 || true; rm -rf "$DOCKER_CONFIG"' EXIT
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin
printf '\\n==> Fetch the captured production schema\\n'
if ! docker pull "$SCHEMA_IMAGE" >/dev/null 2>&1; then
  echo "WARNING: No captured schema at $SCHEMA_IMAGE, so AC-8 is NOT being checked on this build. Run injishi-schema-capture once production serves from the VPS."
  exit 0
fi
# The image is FROM scratch with no command, so `create` is given a placeholder
# one; the container is never started.
container="$(docker create "$SCHEMA_IMAGE" /schema.sql)"
docker cp "$container:/schema.sql" "$JOB_TMP/schema.sql"
docker rm "$container" >/dev/null
echo true > "$JOB_TMP/available"
wc -l "$JOB_TMP/schema.sql"
'''
                }
                if (readFile(file: "${jobTmp}/available").trim() == 'true') {
                  sh '''#!/bin/bash
set -euo pipefail
printf '\\n==> Restore it\\n'
docker cp "$JOB_TMP/schema.sql" "$SVC_DB:/tmp/schema.sql"
docker exec "$SVC_DB" psql -U injishi -d injishi -v ON_ERROR_STOP=1 -f /tmp/schema.sql
'''
                  ciJob('schema-replay', 20, installStep() + '''
step 'Apply every migration on top of it'
pnpm --filter @injishi/api db:migrate
''', [args: "--network container:${db}", env: ['DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5432/injishi']])
                }
              }
            }
          }
        }
      }
    }

    // ── mobile-release.yml (AC-21) ──────────────────────────────────────────
    // An EAS build starts on a `mobile-v*` tag and on nothing else. EAS builds
    // both platforms on Expo's machines, so nothing here needs macOS.
    stage('mobile-release: EAS build') {
      when { tag pattern: 'mobile-v*', comparator: 'GLOB' }
      steps {
        script {
          ciJob('mobile-release', 30, installStep() + '''
step 'Check before spending build minutes'
# The same script ci runs; a tag can point at any commit. Its fingerprint
# verdict needs origin/main, which a tag build does not fetch, so it prints none.
pnpm --filter @injishi/mobile check:ci

step 'Is EAS set up'
if [ ! -f apps/mobile/eas.json ]; then
  echo "NOTICE: No apps/mobile/eas.json yet, so no EAS build starts. The checks above passed."
  exit 0
fi

step 'Start the build'
# The production profile: `mobile-v*` means a release.
cd apps/mobile
npx --yes eas-cli@latest build --non-interactive --no-wait --platform all --profile production
''', [heroui: false, creds: [string(credentialsId: 'injishi-expo-token', variable: 'EXPO_TOKEN')]])
        }
      }
    }
  }

  post {
    always {
      // Service containers of this build that an abort left behind.
      sh '''#!/bin/bash
ids="$(docker ps -aq --filter "label=injishi-ci=${CI_NAME:-none}")"
if [ -n "$ids" ]; then docker rm -fv $ids >/dev/null 2>&1 || true; fi
'''
    }
    cleanup {
      // Keep .git for the next build's fetch; drop node_modules and build output.
      sh '''#!/bin/bash
git reset --hard --quiet HEAD 2>/dev/null || true
git clean -ffdxq 2>/dev/null || true
rm -rf "$WORKSPACE@tmp/injishi-ci" || true
'''
    }
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

// The `needs` of ci-complete, in ci.yml's order.
def ciNeeds() {
  return ['workflow-guard', 'changes', 'typecheck', 'lint', 'test-unit', 'build-web', 'build-app', 'build-api', 'mobile', 'tokens', 'cycles']
}

// A clean tree, the toolchain image, and what this build runs.
def prepare() {
  ciResults = [:]
  ciFlags = [:]
  for (String job : ciNeeds()) {
    ciResults[job] = 'skipped'
  }
  env.CI_TMP = "${env.WORKSPACE}@tmp/injishi-ci"
  env.CI_NAME = sh(returnStdout: true, script: 'printf %s "$BUILD_TAG" | tr -c "A-Za-z0-9_.-" "-"').trim()
  sh '''#!/bin/bash
set -euo pipefail
# A fresh checkout, as a hosted runner starts from. The workspace is kept
# between builds for its .git; everything else the last build left goes.
git reset --hard --quiet HEAD
git clean -ffdxq
rm -rf "$CI_TMP"
mkdir -p "$CI_TMP" "$CACHE_ROOT/pnpm-store"

# The toolchain (.github/actions/pnpm-setup): Node from mise.toml, pnpm from
# packageManager in package.json, never written down here.
node_version="$(sed -nE 's/^[[:space:]]*node[[:space:]]*=[[:space:]]*"([^"]*)".*/\\1/p' mise.toml | head -n1)"
if [ -z "$node_version" ]; then
  echo "ERROR: No node version pin found in mise.toml. ADR-052 requires the Node version to be READ from mise.toml, never retyped into a pipeline."
  exit 1
fi
package_manager="$(jq -r '.packageManager // ""' package.json)"
pnpm_version="${package_manager#pnpm@}"
pnpm_version="${pnpm_version%%+*}"
if [ "${package_manager%%@*}" != pnpm ] || [ -z "$pnpm_version" ]; then
  echo "ERROR: package.json has no pnpm@<version> packageManager."
  exit 1
fi
image="injishi-ci-node:${node_version}-pnpm${pnpm_version}"
if docker image inspect "$image" >/dev/null 2>&1; then
  echo "toolchain image $image is present"
else
  printf 'ARG NODE_VERSION\\nFROM node:${NODE_VERSION}-bookworm\\nARG PNPM_VERSION\\nRUN npm install --global "pnpm@${PNPM_VERSION}" && pnpm --version\\n' |
    docker build --tag "$image" --build-arg "NODE_VERSION=$node_version" --build-arg "PNPM_VERSION=$pnpm_version" -
fi
echo "Node $node_version, from mise.toml; pnpm $pnpm_version, from packageManager"

# What this build runs. ci: pull requests against main and pushes to main.
# integration: pushes to main, and pull requests touching its paths.
run_ci=false
run_integration=false
base=""
if [ -n "${TAG_NAME:-}" ]; then
  :
elif [ -n "${CHANGE_ID:-}" ]; then
  if [ "${CHANGE_TARGET:-}" = main ]; then
    run_ci=true
    # pull_request.base.sha: the tip of main this pull request is merged onto.
    base="$(git rev-parse --verify --quiet 'refs/remotes/origin/main^{commit}' || true)"
    if [ -z "$base" ] && git rev-parse --verify --quiet 'HEAD^2' >/dev/null; then
      base="$(git rev-parse 'HEAD^1')"
    fi
  fi
elif [ "${BRANCH_NAME:-}" = main ]; then
  run_ci=true
  run_integration=true
  # push's `before`: what main was at when this branch job last built. Empty on
  # the first build, which runs everything.
  base="${GIT_PREVIOUS_COMMIT:-}"
fi

files=""
diff_ok=false
if [ -n "$base" ] && files="$(git diff --name-only "$base...HEAD" 2>/dev/null)"; then
  diff_ok=true
fi
ci_base="$base"
if [ "$diff_ok" = true ] && printf '%s\\n' "$files" | grep -qE '^(Jenkinsfile$|jenkins/)'; then
  # scripts/ci-changes.mjs runs everything on a change under .github/; the
  # pipeline now lives here, so a change to it runs everything too.
  echo "This change edits the pipeline itself, so every ci job runs."
  ci_base=""
fi
if [ "$run_ci" = true ] && [ -n "${CHANGE_ID:-}" ]; then
  if [ "$diff_ok" != true ] || printf '%s\\n' "$files" | grep -qE '^(server/api/|packages/contracts/|packages/auth/|pnpm-lock[.]yaml$|Jenkinsfile$)'; then
    run_integration=true
  fi
fi
printf 'CI_IMAGE=%s\\nRUN_CI=%s\\nRUN_INTEGRATION=%s\\nCI_BASE=%s\\n' "$image" "$run_ci" "$run_integration" "$ci_base" > "$CI_TMP/plan"
cat "$CI_TMP/plan"
'''
  def plan = keyValues(readFile(file: "${env.CI_TMP}/plan"))
  env.CI_IMAGE = plan['CI_IMAGE']
  env.RUN_CI = plan['RUN_CI']
  env.RUN_INTEGRATION = plan['RUN_INTEGRATION']
  env.CI_BASE = plan['CI_BASE'] ?: ''
}

// One former GitHub Actions job. `body` runs under bash in the toolchain
// container (or on the agent, with container: false) under the job's own time
// limit. The limit is coreutils `timeout`, so an overrun fails this job the way
// timeout-minutes did instead of aborting the build. A failure marks this stage
// and the build failed and lets the next job run, as independent jobs did; an
// abort still stops the build. The result is kept for ci-complete.
//
// opts: container (default true), heroui (bind HEROUI_AUTH_TOKEN, default true:
// ci.yml and integration.yml set it for every job), creds (more bindings),
// args (docker run arguments), env (KEY=value list).
def ciJob(String name, int minutes, String body, Map opts = [:]) {
  ciResults[name] = 'failure'
  catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
    def jobScript = "${env.CI_TMP}/${name}.sh"
    writeFile file: jobScript, text: jobPreamble() + body
    def creds = []
    if (opts.heroui != false) {
      creds << string(credentialsId: 'injishi-heroui-auth-token', variable: 'HEROUI_AUTH_TOKEN')
    }
    creds.addAll(opts.creds ?: [])
    def jobEnv = ["JOB_TMP=${env.CI_TMP}/${name}"]
    jobEnv.addAll(opts.env ?: [])
    def command = "timeout --kill-after=60s ${minutes}m bash '${jobScript}'"
    withCredentials(creds) {
      withEnv(jobEnv) {
        if (opts.container == false) {
          sh command
        } else {
          docker.image(env.CI_IMAGE).inside(opts.args ?: '') {
            sh command
          }
        }
      }
    }
    ciResults[name] = 'success'
  }
}

def jobPreamble() {
  return '''#!/bin/bash
set -euo pipefail
step() { printf '\\n==> %s\\n' "$*"; }
mkdir -p "$JOB_TMP"
# pnpm's store, shared by every injishi build on this agent. If the cache folder
# is not visible in this container, a private one still works, only slower.
PNPM_STORE="$CACHE_ROOT/pnpm-store"
if ! { mkdir -p "$PNPM_STORE" && [ -w "$PNPM_STORE" ]; } 2>/dev/null; then
  PNPM_STORE="$HOME/.pnpm-store"
fi
'''
}

// .github/actions/pnpm-setup with install: 'true'.
def installStep() {
  return '''
step 'Install the workspace'
pnpm install --frozen-lockfile --store-dir "$PNPM_STORE"
'''
}

// @injishi/contracts and @injishi/design-tokens are compiled; consumers read dist/.
def compiledPackagesStep() {
  return '''
step 'Build the compiled packages'
pnpm --filter @injishi/contracts --filter @injishi/design-tokens build
'''
}

// integration.yml's job environment for `database`.
def integrationEnv() {
  return [
    'DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5432/injishi',
    'REDIS_HOST=127.0.0.1',
    'REDIS_PORT=6379',
    // AC-7b: the fixed OTP code exists only in a demo process. NODE_ENV is
    // deliberately NOT production, which refuses to boot without SMTP_URL.
    'INJISHI_ENVIRONMENT=demo',
    'COOKIE_SECRET=ci-only-cookie-secret-not-a-real-one',
    'BETTER_AUTH_SECRET=ci-only-better-auth-secret-not-a-real-one',
    'BETTER_AUTH_URL=http://127.0.0.1:8000',
    'CORS_ORIGINS=http://127.0.0.1:3000',
    'LOG_LEVEL=warn',
    // No MinIO: ADR-052 names Postgres and Redis only, and `local` writes to disk.
    'STORAGE_ADAPTER_MODE=local',
    'VERIFY_API_URL=http://127.0.0.1:8000',
    'PORT=8000'
  ]
}

// integration.yml's service containers: Postgres 17 (and Redis 7), the same
// images, credentials and health checks, on the host's Docker for this build
// only. Redis and the job's container share Postgres' network namespace, so
// 127.0.0.1:5432 and 127.0.0.1:6379 mean what they meant on the runner, and
// three builds at once never collide on a port. Removed afterwards, always.
def withServices(String name, boolean redis, Closure body) {
  def db = "${env.CI_NAME}-${name}-db"
  def cache = redis ? "${env.CI_NAME}-${name}-redis" : ''
  withEnv(["SVC_DB=${db}", "SVC_REDIS=${cache}"]) {
    try {
      sh '''#!/bin/bash
set -euo pipefail
healthy() {
  local status
  for _ in $(seq 1 30); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$1")"
    if [ "$status" = healthy ]; then echo "$1 is healthy"; return 0; fi
    if [ "$status" = unhealthy ]; then break; fi
    sleep 5
  done
  echo "ERROR: service container $1 did not become healthy"
  docker logs --tail 100 "$1" 2>&1
  return 1
}
db_args=(--detach --name "$SVC_DB" --label "injishi-ci=$CI_NAME")
db_args+=(--env POSTGRES_USER=injishi --env POSTGRES_PASSWORD=injishi --env POSTGRES_DB=injishi)
db_args+=(--health-cmd "pg_isready -U injishi" --health-interval 5s --health-timeout 5s --health-retries 20)
docker run "${db_args[@]}" postgres:17-alpine >/dev/null
if [ -n "${SVC_REDIS:-}" ]; then
  redis_args=(--detach --name "$SVC_REDIS" --label "injishi-ci=$CI_NAME" --network "container:$SVC_DB")
  redis_args+=(--health-cmd "redis-cli ping" --health-interval 5s --health-timeout 5s --health-retries 20)
  docker run "${redis_args[@]}" redis:7-alpine >/dev/null
fi
healthy "$SVC_DB"
if [ -n "${SVC_REDIS:-}" ]; then healthy "$SVC_REDIS"; fi
'''
      body(db)
    } finally {
      sh '''#!/bin/bash
for c in "$SVC_DB" ${SVC_REDIS:-}; do
  printf '\\n==> service container %s, last 200 lines\\n' "$c"
  docker logs --tail 200 "$c" 2>&1 || true
done
docker rm -fv "$SVC_DB" ${SVC_REDIS:-} >/dev/null 2>&1 || true
'''
    }
  }
}

// ci-complete's CI_NEEDS: {"<job>":{"result":"success|failure|skipped"}, ...}
def ciNeedsJson() {
  def parts = []
  for (String job : ciNeeds()) {
    parts << "\"${job}\":{\"result\":\"${ciResults[job]}\"}"
  }
  return '{' + parts.join(',') + '}'
}

// name=value lines into a map.
def keyValues(String text) {
  def values = [:]
  for (String line : text.split('\n')) {
    def at = line.indexOf('=')
    if (at > 0) {
      values[line.substring(0, at).trim()] = line.substring(at + 1).trim()
    }
  }
  return values
}

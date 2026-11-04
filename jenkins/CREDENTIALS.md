# Jenkins credentials and cutover for injishi

Jenkins (https://deploy.shamis.app) replaces GitHub Actions for this
repository. GitHub secrets cannot be read back, so every credential below is
created fresh in Jenkins (global scope, ids prefixed `injishi-`). Nothing here
holds a value.

| Id | Kind | Replaces | Used by |
| --- | --- | --- | --- |
| `injishi-heroui-auth-token` | Secret text | secret `HEROUI_AUTH_TOKEN` | `injishi` (every ci and integration stage) |
| `injishi-ghcr` | Username with password | `GITHUB_TOKEN` with `packages: read/write` | `injishi` (image; schema replay on `main` builds only, ADR-078 AC-6), `injishi-schema-capture` |
| `injishi-github-status` | Secret text | new with ADR-078 | `injishi` (the `injishi/ci-complete` and `injishi/integration` statuses), `injishi-pr-rules` |
| `injishi-vps-ssh` | SSH username with private key, user `gha-runner` | the self-hosted runner `injishi-vps` | `injishi-deploy-staging`, `injishi-deploy-production`, `injishi-backup`, `injishi-schema-capture` |
| `injishi-jenkins-api` | Username with password | `GITHUB_TOKEN` with `actions: read` | `injishi-deploy-production` (its gates) |
| `injishi-expo-token` | Secret text | secret `EXPO_TOKEN` (never actually set in GitHub) | `injishi` (mobile-release, `mobile-v*` tags) |

GitHub repository variables: none are set, so their defaults became plain
environment values in the Jenkinsfiles: `DEPLOY_HEALTH_TIMEOUT=600`,
`DEPLOY_LOCK_TIMEOUT=1800` (both deploy jobs), `BACKUP_MAX_AGE_HOURS=26`
(`injishi-deploy-production`). They are deliberately not build parameters: the
backup limit is a gate, and a gate the person pressing the button can raise is
not one.

## How to obtain each

**`injishi-heroui-auth-token`.** HeroUI Pro's CI/CD token, one per licence. The
same value is already set as `HEROUI_AUTH_TOKEN` on both Dokploy services
(project Injishi, Environment tab), which write it to
`/etc/dokploy/compose/<appName>/code/infra/docker/.env` on the VPS. Copy it from
there (as root: `sed -n 's/^HEROUI_AUTH_TOKEN=//p'
/etc/dokploy/compose/injishi-production-igxxsu-k793z7/code/infra/docker/.env`).
If it was rotated, take the current one from the HeroUI Pro account and update
Dokploy as well.

**`injishi-ghcr`.** A classic personal access token with `write:packages`
(includes `read:packages`), from an account with write access to
`hangaasoftwares/injishi`, preferably a machine user: GitHub > Settings >
Developer settings > Personal access tokens > Tokens (classic). GHCR accepts
classic tokens only. Username is that GitHub login. The packages
`ghcr.io/hangaasoftwares/injishi-api` and `injishi-schema` must grant it write
(packages Actions published inherit the repository's access).

**`injishi-vps-ssh`.** A new key, used only through a forced command:

```bash
# anywhere trusted
ssh-keygen -t ed25519 -N '' -C jenkins-injishi -f injishi-vps-ssh
# private half -> Jenkins credential injishi-vps-ssh, username gha-runner

# on sshami-vps, as root (ssh -p 222 root@102.202.208.167), from a checkout of the merged repo
install -o root -g root -m 0755 jenkins/vps/injishi-ci-gate.sh /usr/local/bin/injishi-ci-gate
install -d -o gha-runner -g gha-runner -m 700 /home/gha-runner/.ssh
echo 'restrict,from="179.197.85.203",command="/usr/local/bin/injishi-ci-gate" ssh-ed25519 AAAA...public-half... jenkins-injishi' \
  >> /home/gha-runner/.ssh/authorized_keys
chown gha-runner:gha-runner /home/gha-runner/.ssh/authorized_keys
chmod 600 /home/gha-runner/.ssh/authorized_keys

# from the cloud server: anything but a gate verb is refused
ssh -i injishi-vps-ssh -p 222 gha-runner@102.202.208.167 nonsense   # -> denied: 'nonsense'
```

The options are the shape of root's existing `github-actions-tida-deploy` line
(`restrict,command="/usr/local/bin/tida-deploy-gate"`), plus `from=` pinned to
the Jenkins server. It goes in `gha-runner`'s file, not root's, because the
runner ran as `gha-runner` (non-root, `docker` group; ADR-052 AC-17).
`jenkins/vps/injishi-ci-gate.sh` is the source of the gate: reinstall it after
every change to it.

The backup's host settings stay on the host. When backups are configured, put
`BACKUP_DESTINATION`, `BACKUP_ENCRYPTION_RECIPIENT` and `BACKUP_RETENTION_DAYS`
in `/home/gha-runner/injishi-ci.env` (KEY=value lines, owner `gha-runner`, mode
600). Today they are set nowhere (the runner's `.env` holds only `LANG` and
`DEMO_COMPOSE_PROJECT`), and `pg_dump`, `age` and `rclone` are not installed on
the VPS, which is why `backup` fails in Actions now.

**`injishi-github-status`** (ADR-078). A fine grained personal access token,
resource owner `hangaasoftwares`, repository access `hangaasoftwares/injishi`
only, with these permissions and nothing else: Commit statuses read and write,
Pull requests read, Issues read, Contents read, Metadata read. Mint it from an
account with Write on the repository (Triage cannot post statuses): the owner's,
or a machine user's. The organisation may have to approve it under Settings >
Personal access tokens. Write its expiry date here when you create it, and make
a new one before then:

- Expires: _(fill in)_

It is the one credential a pull request build binds, and only around its own
`curl` calls, which run no repository code. `injishi-pr-rules` holds it to read
every open pull request and post `injishi/pr-rules` and `injishi/review`. Until
it exists, builds still run and log that they post no status, and
`injishi-pr-rules` fails every run, which is how a missing or expired token
shows.

**`injishi-jenkins-api`.** Manage Jenkins > Users > Create User (e.g.
`injishi-gate`), sign in as it, Security > API Token > Add new Token. Username is
the user id, password the token. Under the current `loggedInUsersCanDoAnything`
strategy it can do anything; it needs only Overall/Read and Job/Read.

**`injishi-expo-token`.** expo.dev, the account or organisation owning the
`injishi` project (`apps/mobile/app.config.ts`): Settings > Access tokens >
Create token (a robot user's). Needed only before the first `mobile-v*` tag.

## Cutover

Merging the pull request is the switch: it deletes the ported workflows, so
Actions stops and Jenkins' main build takes over.

1. **VPS** (root, any time before merge; harmless on its own): install the gate
   and add the key line as above. Use the gate from the pull request branch until
   it merges.
2. **Jenkins: credentials.** Create the six above (`injishi-github-status`
   since ADR-078).
3. **Jenkins: jobs** (JOBS.json). The multibranch job `injishi`: GitHub source
   `hangaasoftwares/injishi`, discover branches (excluding those filed as PRs),
   pull requests from origin merged with the target, pull requests from forks
   merged with the target with trust "Nobody" (ADR-078 AC-5: a fork pull request
   is built with its target branch's `Jenkinsfile`, never its own; every
   teammate works from a fork, so without this their pull requests get no CI),
   tags; head filter `main PR-* mobile-v*`; build strategies regular
   branches, change requests, tags newer than one day. Then the five pipeline
   jobs, `injishi-pr-rules` (ADR-078 AC-11, `jenkins/pr-rules.Jenkinsfile`,
   concurrent builds off, its cron in the file) among them (branch `main`,
   lightweight checkout, concurrent builds allowed unless named), with
   the `COMMIT` string parameter defined on `injishi-deploy-staging` and
   `injishi-deploy-production` at creation, because the main build's
   `build job:` drops a parameter the job has not declared yet. Their crons are
   in the Jenkinsfiles and register on the first run (or set them at creation:
   `15 0 * * *` backup, `30 2 * * *` schema-capture). Until the merge their
   Jenkinsfiles are not on main, so a run before then fails to load, harmlessly.
4. **Open the pull request.** Jenkins builds `PR-<n>` from the PR's own
   Jenkinsfile. Because the pipeline changed, every ci job and both integration
   stages run. Expect ci (through ci-complete) green: ci was green on
   `e739ff3e` (`0e7b1605` before the 2026-11-04 identity rewrite of `main`).
   Expect `integration: against a real database` red at
   `verify:authz` ("3 of 59 check(s) FAILED"): it fails the same way on every
   push to main in Actions today, a product failure the port does not cause.
5. **Merge.** The main build runs ci, pushes the API image, starts
   `injishi-deploy-staging`, then runs integration.
6. **After merge.** Run `injishi-backup` and `injishi-schema-capture` once by
   hand if their crons were not set at creation. Stop and unregister the GitHub
   runner on the VPS once nothing in Actions needs it (only the disabled
   `demo-recover` names it): `systemctl disable --now
   actions.runner.hangaasoftwares-injishi.sshami-vps.service`, then remove it
   under Settings > Actions > Runners. Keep the `gha-runner` user: Jenkins'
   key logs in as it.

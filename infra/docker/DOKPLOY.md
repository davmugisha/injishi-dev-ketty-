# Deploying Injishi on Dokploy (Hangaa Softwares VPS)

This file is the owner of VPS / Dokploy deploy facts. Other docs may restate
them; they do not define them.

Three stacks run on one VPS, each from its own compose file in this directory,
under its own project name and env file. Whether each is up right now is build
state (the progress tracker), not this file.

| Stack | What it is | Compose file | Project / env file / source |
| --- | --- | --- | --- |
| **Production** | The real product and real data | [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml) | `-p injishi`, `/opt/injishi/.env`, `/opt/injishi/src` at the released commit |
| **Staging** | Where a release is tried first | [`docker-compose.staging.yml`](docker-compose.staging.yml) | `-p injishi-staging`, `/opt/injishi-staging/.env`, `/opt/injishi-staging/src` at the commit under test |
| **Demo** | The public showroom: staging's commit, sample data, a published sign in code, rebuilt every night | [`docker-compose.demo.yml`](docker-compose.demo.yml) | `-p injishi-demo` (Dokploy's `injishi-demo-rllflw` on the Hangaa VPS, see [the runner](#the-self-hosted-runner)), `/opt/injishi-demo/.env`, `/opt/injishi-demo/src` at staging's commit |

The demo used to live inside production's stack: the same API container
answered on the demo host and chose a database per request. It is a stack of
its own now (ADR-043), so nothing it does (a migration, a crash, a live
adapter, a stranger's upload) can reach production.

`infra/docker/docker-compose.yml` is the local stack and never runs here.
Secrets live only in the env files on the host: copy the names from
[`dokploy.env.example`](dokploy.env.example),
[`dokploy-staging.env.example`](dokploy-staging.env.example) and
[`dokploy-demo.env.example`](dokploy-demo.env.example), never commit values,
and never share a secret between stacks.

## Target

| Fact | Value |
| --- | --- |
| SSH | `ssh -o BatchMode=yes -p 222 root@102.202.208.167` |
| Host SSH port | **222** (not 22) |
| Dokploy organisation | Hangaa Softwares |
| Project | Injishi |
| Edge | Dokploy Traefik (`traefik:v3.6.7`) on TCP 80 and 443 |
| Production source | `/opt/injishi/src` (injishi repo root, at the released commit) |
| Staging source | `/opt/injishi-staging/src` (a second checkout, at the commit under test) |
| Demo source | `/opt/injishi-demo/src` (a third checkout, moved to staging's commit by the nightly job) |

Production and staging are started with plain `docker compose` from their
source directory, which is the build context (`context: ../..` from the compose
file). `INJISHI_COMMIT` stamps the API image with the commit it was built from:

```sh
cd /opt/injishi/src && INJISHI_COMMIT=$(git rev-parse --short HEAD) docker compose -p injishi \
  -f infra/docker/docker-compose.dokploy.yml --env-file /opt/injishi/.env up -d --build

cd /opt/injishi-staging/src && INJISHI_COMMIT=$(git rev-parse --short HEAD) docker compose -p injishi-staging \
  -f infra/docker/docker-compose.staging.yml --env-file /opt/injishi-staging/.env up -d --build
```

The demo is built and started by its nightly job, never by a hand `up --build`
(see [The demo](#the-demo)).

Routing is declared in each compose file as Traefik labels, the way Paperclip on
this host is routed: the `web` and `websecure` entrypoints, the `letsencrypt`
resolver and the `redirect-to-https@file` middleware come from Dokploy's
Traefik. Router names start with `injishi-production-`, `injishi-staging-` or
`injishi-demo-`, and images are tagged `:production`, `:staging` or `:demo`, so
the stacks never overwrite each other's routers or images. Do not also bind
these hosts as Dokploy domain rows or in a Traefik file: two routers for one
host is a coin toss.

## Which platform each stack is

Each compose file pins two values as literals in its API and worker
`environment:` block, never from its env file, so a mistyped line in an env
file cannot change what a stack is:

| Stack | `INJISHI_ENVIRONMENT` | `INJISHI_DATABASE_KIND` | `PAYMENT_ADAPTER_MODE` | Frontend build `NEXT_PUBLIC_INJISHI_ENVIRONMENT` |
| --- | --- | --- | --- | --- |
| Production | `production` | `real` | `off` | `production` |
| Staging | `production` | `sample` | unset (mock) | `production` |
| Demo | `demo` | `sample` | `mock` | `demo` |

**Production takes no payments.** No provider is chosen and there are no
credentials, so production pins `PAYMENT_ADAPTER_MODE=off`: every charge is
refused and the checkout says nothing was charged. The API refuses to boot with
`INJISHI_DATABASE_KIND=real` and a payment mode of `mock` or unset, because an
unset mode means mock and a real database must never record imaginary money as
captured. `live` is the only other value it accepts there, and `live` refuses to
boot until a live adapter is registered in `payments.module.ts`.

`INJISHI_DATABASE_KIND` is checked against the database itself at boot. A
database is `sample` when its `database_identity` table holds the one row
`mark-sample-database.mjs --sample` writes, and Postgres refuses that row while
any user exists, so only a database that was empty when it was marked can ever
be sample. The API refuses to boot when the two disagree, and a `demo` process
refuses to boot on anything but a sample database and on
`PAYMENT_ADAPTER_MODE=live` or `VSDC_ADAPTER_MODE=live`. The fixed sign in code
`123456` exists only in a `demo` process.

`NEXT_PUBLIC_INJISHI_ENVIRONMENT` does one thing: in a `demo` build, each
frontend's middleware strips production's session cookies from every request
before anything reads it. Every screen decision (the published code, the
persona picker, the operator app's mock banner and fixture money actions) asks
the API's `GET /api/v1/platform` instead.

## Public hosts

| Host | Stack | Served by | Notes |
| --- | --- | --- | --- |
| `www.injishi.com` | production | `web` | The public origin, and the operator zone under `/w`, `/oversight` |
| `injishi.com` | production | `web` | Permanent redirect to `www`, path kept |
| `app.injishi.com` | production | `web` | Redirect into the zone: `/` to `/w`, any other path kept |
| `api.injishi.com` | production | `api` | |
| `admin.injishi.com` | production | `admin` | IP allowlist, then the session gate |
| `storage.injishi.com` | production | `minio` (S3 port 9000) | Signed URL reads only: `GET`, `HEAD` and `OPTIONS`, never a path under `/minio/`. Named by `STORAGE_HOST` |
| `www-demo.injishi.com` | demo | demo `web` | Public |
| `app-demo.injishi.com` | demo | demo `web` | Redirect into the demo zone, as `app.` does |
| `api-demo.injishi.com` | demo | demo `api` | Public: its own API, not production's |
| `admin-demo.injishi.com` | demo | demo `admin` | `ADMIN_ALLOWED_IPS`, then the session gate |
| `storage-demo.injishi.com` | demo | demo `minio` | Public, reads only, as production's |
| `mail-demo.injishi.com` | demo | demo `mailpit` (inbox, port 8025) | `ADMIN_ALLOWED_IPS`. SMTP (1025) is never routed |
| `www.<STAGING_DOMAIN>` | staging | staging `web` | IP allowlist |
| `app.<STAGING_DOMAIN>` | staging | staging `web` | Redirect into the zone, behind the same allowlist |
| `api.<STAGING_DOMAIN>` | staging | staging `api` | |
| `admin.<STAGING_DOMAIN>` | staging | staging `admin` | IP allowlist, then the session gate |
| `storage.<STAGING_DOMAIN>` | staging | staging `minio` | IP allowlist, then reads only, as production |
| `mail.<STAGING_DOMAIN>` | staging | staging `mailpit` (inbox, port 8025) | IP allowlist. The inbox where testers read sign in codes; SMTP (1025) is never routed |

The operator app never has a host of its own. It is a zone under web
(`/w/*`, `/oversight/*`, `/operator-static/*`), reached inside each stack's
compose network at `OPERATOR_APP_URL=http://app:3002`, so `NEXT_PUBLIC_PMS_URL`
is always that stack's web origin. `app.` hosts exist only to redirect old
links into the zone.

## The demo

**What it is.** The newest tested work, shown to anyone: staging's commit,
rebuilt from scratch every night, on sample data (the one recipe
`seed-sample.mjs` staging and a laptop also run). Anyone may sign in as any
seeded persona with the code `123456`, which the sign in screens state; the
roster includes the staff persona `ops@demo.injishi.com` (`StaffRole` `ops`),
which opens `admin-demo` after the step up.

**How it is kept apart from production.**

| Concern | Production | Demo |
| --- | --- | --- |
| Stack | `-p injishi` | `-p injishi-demo` (or `DEMO_COMPOSE_PROJECT`), its own everything |
| Database | `db` volume, no sample marker | its own `db`; the live database is `injishi_demo`, marked sample |
| Redis | persistent | its own, no persistence, flushed nightly |
| Object storage | `minio`, `storage.injishi.com` | its own `minio`, own KMS key and API user, `storage-demo.injishi.com`, emptied nightly |
| Mail | the relay in `SMTP_URL` | its own `mailpit`, no volume, emptied nightly; no relay credential in its env file |
| Session secret | `BETTER_AUTH_SECRET` | its own `BETTER_AUTH_SECRET` |
| Session cookie name | `better-auth.session_token` | `injishi-demo.session_token` (and `injishi-oversight-demo.*` for the console) |
| Adapters | payments pinned `off`; the rest as configured | pinned to mock; a `demo` process refuses live payments or live EBM at boot |
| Code it runs | the released commit | staging's commit, nightly |

**One thing still crosses: production's cookie.** Both stacks set cookies on
`.injishi.com`, so a browser signed in to production carries that session to
every demo host. The demo drops it before anything reads the request, in the
API's first request hook and as the first statement of each demo frontend's
middleware, and it holds no production secret, so it could never verify one.
Every environment's API logs redact `cookie`, `authorization` and `set-cookie`.

**The nightly job.** [`demo-nightly.sh`](demo-nightly.sh), from host cron at
03:00 Africa/Kigali (01:00 UTC; Rwanda keeps no daylight saving):

```cron
MAILTO=<the maintainer>
0 1 * * * /opt/injishi-demo/src/infra/docker/demo-nightly.sh >> /var/log/injishi-demo-nightly.log
```

**The `MAILTO`, and the missing `2>&1`, are both load bearing** (ADR-052
AC-22b). This is host cron, not a GitHub Actions run, so GitHub cannot report
it: the one failure that most needs to surface is the one the pipeline cannot
see. cron mails whatever a job writes, so the script sends progress to stdout
and every failure to stderr, the line sends stdout to the log, and stderr is
left alone. A good night is silent; a failure, or a give up waiting for the
lock, arrives as mail. The old line ended `2>&1`, which put the failures in
the log file alongside everything else and mailed nothing.

Address it through the same relay `SMTP_URL` names, so there is one mail path
out of this host rather than two.

In order, stopping at the first failure: check out staging's commit in
`/opt/injishi-demo/src`; build every demo image as `:demo-next`; create
`injishi_demo_next` and migrate, mark and seed it with the candidate API image;
then, only when all of that succeeded, swap (stop the demo, rename the live
database to `injishi_demo_prev` and the candidate to `injishi_demo`, retag the
images, empty the bucket, flush Redis, empty Mailpit, start the demo) and wait
for the API and web health checks. Healthy, it drops the previous database and
images. Not healthy within ten minutes, it prints the new API's log, swaps the
previous database and images back and exits non zero. A failure before the swap
drops the candidate and leaves yesterday's demo running untouched.

That includes `compose up` itself failing, which it does when the new API is
unhealthy: compose waits on the API's health check before starting what
depends on it. Until 2026-10-01 that exit ended the script before the swap back,
and the demo stayed down from the 06:42 UTC rebuild (an API that refused to
boot, `2f5f8d3`) until the kept `:demo-prev` images and `injishi_demo_prev`
were swapped back by hand. That hand restore is exactly the script's own swap
back: stop the app services, rename `injishi_demo` to `injishi_demo_next` and
`injishi_demo_prev` to `injishi_demo`, retag each `:demo-prev` as `:demo`, `up -d`.

The job reads no secret itself, holds a lock so two runs never overlap, and
logs one line per step to `/var/log/injishi-demo-nightly.log`. A presenter
should know that the demo runs code production has not released: the job
guards against a broken build or seed, not a broken screen.

**On the Hangaa VPS the nightly is the `demo-recover` workflow, not host
cron.** There is no staging to follow, so at 01:00 UTC that workflow runs this
same script on the [runner](#the-self-hosted-runner), at the newest commit on
`main` whose `ci` succeeded; run by hand (Actions, demo-recover, Run
workflow) it makes the same pick, and refuses one that does not contain the
commit the demo already runs, so a stale answer from the runs API cannot roll
the demo back. Root's crontab carries no demo line.
`/opt/injishi-demo/demo-reseed.sh` (not in this repository) stays on the host
for resetting the data without a rebuild: it seeds a candidate database with
the API image already running and swaps it in, under the same build lock.

**Reseeding by hand**, without rebuilding, keeps the images and reruns the
recipe against the live database:

```sh
cd /opt/injishi-demo/src && docker compose -p "${DEMO_COMPOSE_PROJECT:-injishi-demo}" -f infra/docker/docker-compose.demo.yml \
  --env-file /opt/injishi-demo/.env exec -T api node scripts/seed-sample.mjs
```

It is additive (every insert skips a row that exists) and moves the "last
reset" time the sign in screens show. `seed-demo.mjs --refresh` instead keeps
the demo roster's rows and moves their dates to today.

## First bring up of a sample stack

A sample stack's API refuses to boot until its database carries the sample
marker, so the FIRST bring up of the demo or of staging marks and seeds the
empty database in a one time container before `up -d`. Otherwise the API
restarts in a loop, refusing each time.

**The demo:** create `/opt/injishi-demo/.env` from
[`dokploy-demo.env.example`](dokploy-demo.env.example), clone the injishi repo
to `/opt/injishi-demo/src`, then run the nightly job once by hand. With no demo
yet, its swap has nothing to keep and it brings the stack up:

```sh
/opt/injishi-demo/src/infra/docker/demo-nightly.sh
```

**Staging:**

```sh
cd /opt/injishi-staging/src
S="docker compose -p injishi-staging -f infra/docker/docker-compose.staging.yml --env-file /opt/injishi-staging/.env"
export INJISHI_COMMIT=$(git rev-parse --short HEAD)
$S build
$S up -d db
$S run --rm --no-deps api sh -c \
  'node scripts/migrate.mjs && node scripts/mark-sample-database.mjs --sample && node scripts/seed-sample.mjs'
$S up -d
```

`mark-sample-database.mjs --sample` refuses a database that holds any user, so
an existing staging database from before ADR-043 cannot be marked: take it down
with its volumes (`$S down -v`; staging holds no data worth keeping) and run the
steps above. Running the mark twice is harmless; it exits 0 the second time.

## Staging

- **Its own domain.** Production's session cookie is set on `.injishi.com`, so a
  browser hands a live production session to every host under that domain. A
  staging host there would receive real production sessions and run
  unreleased code against them. `STAGING_DOMAIN` must be a domain production does
  not use (a second registered domain, or `injishi.rw` if it is yours and unused);
  the staging compose refuses to start without it.
- **Not public.** Staging `web` (and so `app.`), `admin`, `storage.` and the
  `mail.` inbox answer only to `STAGING_ALLOWED_IPS`; unset, that is loopback
  only, which closes staging. The staging API stays open like production's,
  because the frontends call it server side through its public address; the
  session guards are its boundary.
- **A production process on sample data.** It issues random codes like
  production, on a database seeded with the same recipe as the demo (demo
  roster included). Never a copy of production: production rows are real
  personal data (Law 058/2021).
- **Every service has a ceiling**, so a test run cannot starve production.
- **Mail never leaves staging.** The compose file fixes
  `SMTP_URL=smtp://injishi-mailpit:1025`, so every message the staging API sends
  is caught by its own `mailpit` and read at `mail.<STAGING_DOMAIN>` behind
  `STAGING_ALLOWED_IPS`. There is no relay credential to set, leak or spend; never
  give staging a real relay. Never set `OTP_DEBUG_LOG` here either: a shared
  host's logs are read by more than one person, a printed code is a working
  credential, and the inbox is already the way to read one.
- **Storage is its own.** Its own `minio`, KMS key, root password and API user,
  never production's, answering on `storage.<STAGING_DOMAIN>` behind the same
  allowlist.

## Object storage and mail

**Storage is MinIO over the S3 API, on this host** (in-country, Law 058/2021),
one MinIO per stack with one bucket each. The API runs
`STORAGE_ADAPTER_MODE=live` and reaches MinIO over the compose network; a
browser never reaches a bucket, only a URL the API signed for the stack's
public storage host, valid for at most 15 minutes.

- **Every object is encrypted at rest** with `MINIO_KMS_SECRET_KEY`
  (`<key-name>:<base64 of 32 random bytes>`). Set it once, at the first `up`.
  Lose it or change it and every stored object is unreadable, so back
  production's up off the host together with the database backups: a restored
  `minio-data` volume without the key it was written under is noise. Staging
  and the demo have keys of their own.
- **Buckets are provisioned, never created by the API.** `minio-init`
  (minio's own server image, which ships `mc`, running [`minio/provision.sh`](minio/provision.sh)) runs on every
  `up`, idempotently: it makes the bucket private (no bucket policy, no
  anonymous access) and SSE-S3 encrypted, and creates the API's own user
  (`STORAGE_S3_ACCESS_KEY`), holding only the `injishi-api` policy: object read,
  write and delete, and bucket list, location and encryption read, on that
  bucket. It refuses to run while a secret is still `change-me`. The API
  refuses to boot on a bucket that is missing or unencrypted
  (`STORAGE_REQUIRE_ENCRYPTION=true`), and refuses `STORAGE_CREATE_BUCKETS` in
  production.
- **Root is for `minio-init` and an operator only.** `MINIO_ROOT_PASSWORD` has
  no default, because the storage host is public. The console is off
  (`MINIO_BROWSER=off`), and the storage router accepts only reads outside
  `/minio/`, so no admin or write call reaches MinIO from outside. Administer
  with `docker compose -p <project> exec minio mc`.
- **Compose reaches MinIO as `injishi-minio`, and Mailpit as
  `injishi-mailpit`**, never `minio` or `mailpit`. Those are aliases on each
  project's own network. `api` also joins `dokploy-network`, where the other
  stacks' `minio` answers to the same short name, and Docker may resolve it
  there: production writing into another stack's store, or the reverse.

**Production's mail leaves through an SMTP relay** named in `SMTP_URL`
(`smtps://user:pass@relay:465`, or `smtp://` for STARTTLS on 587), with
`MAIL_FROM` as the sender. The production compose has no default and refuses to
start without it, and the API refuses to boot under `NODE_ENV=production`
without one. Resend is the documented example, reached over SMTP rather than
through an SDK: `smtps://resend:<api key>@smtp.resend.com:465`, with a key
allowed to send for `MAIL_FROM`'s domain. The URL carries the relay's password,
so it lives only in `/opt/injishi/.env`. Staging and the demo send only to their
own Mailpit.

**A mail that links to web takes its origin from `WEB_URL`** (ADR-053). The owner
claim invitation is the first such mail. Each compose file sets it from the same
host its frontends' `NEXT_PUBLIC_WEB_URL` is built from, so nothing extra goes in
an env file: production `https://${WEB_HOST:-www.injishi.com}`, demo
`https://${WEB_HOST:-www-demo.injishi.com}`, staging
`https://www.${STAGING_DOMAIN}`. It must be an origin with no path. The API
refuses to boot under `NODE_ENV=production` without it, exactly as it does
without `SMTP_URL`.

## Error reporting

The API and the worker report to Sentry (ADR-063), in its EU region, through
`SENTRY_DSN`: the `injishi-api` project's DSN, a public send only key. What they
report is the four money alarms and what breaks: a request that fails with a
500, a fault inside Better Auth's `/api/auth/*` routes, a job failing its last
attempt, and an unhandled rejection or uncaught exception, which still exits
the process. Nothing from a request, a user or a job goes with any of it.

| Stack | Reports | Environment in Sentry | Where the DSN comes from |
| --- | --- | --- | --- |
| Production | yes, once the DSN is set | `production` | `SENTRY_DSN` in the env file; empty until the NCSA registration names Sentry (ADR-063 AC-13) |
| Demo | yes, once the DSN is set | `demo` | `SENTRY_DSN` in `/opt/injishi-demo/.env` |
| Staging | never | none | no line, and the API stays inert even if one reaches it |

The API decides at boot, from the two pinned values above: it reports only as
`production` over a `real` database or `demo` over a `sample` one. Staging
(`production` over `sample`) and a laptop (neither pinned) never report. The
release on every event is the commit the image was built from
(`INJISHI_COMMIT`, baked by `Dockerfile.api`); no deploy step sets anything
else. To prove the wiring on the demo, a staff session with
`admin.system.view` may call `GET /api/v1/demo/crash`, which answers a 500 and
is a 404 on every other stack.

## Admin network gate

`admin`, `admin-demo` and the demo's `mail-demo` inbox answer only to
`ADMIN_ALLOWED_IPS` (comma separated IPs or CIDRs, set in each stack's own env
file), enforced by Traefik before the console's session gate runs. Unset, the
list is `127.0.0.1/32`, so a missing setting closes the console rather than
opening it. The console's role checks are navigation hiding only, which is why
the network gate exists. The allowlist guards only the demo console's frontend:
anyone can sign in as the demo's staff persona and call `api-demo` directly,
and everything they reach is sample data rebuilt nightly.

Traefik sees the client address only while DNS for these hosts is **DNS only**.
Behind a proxying CDN (Cloudflare's orange cloud) every request arrives from the
CDN, and the allowlist either refuses everyone or, if widened to the CDN's
ranges, admits everyone.

## Client address at the API

The API's address keyed rate limits (support, waitlist, certificate
verification) read `request.ip`, which Fastify resolves through `TRUST_PROXY`
(`server/api/src/shared/config/trust-proxy.ts`). All three compose files pin it
to `"1"`: Traefik is the only route to `api` (8000 is `expose`d, never
published), so the address Traefik appends to `X-Forwarded-For` is the client
and anything a caller wrote to the left of it is ignored. Unset, the API trusts
no proxy and every visitor shares Traefik's address, which is one bucket for
everybody. `true` is refused at boot. Put a proxying CDN in front and the chain
is two hops: set `"2"`, or list the proxies' addresses instead of a count.

## Required secrets with no default

`POSTGRES_PASSWORD` has no default in any stack (`${POSTGRES_PASSWORD:?}`):
compose refuses to start without it rather than initialise a database whose
password is `change-me`. Postgres reads it only when the `db-data` volume is
first created, so on a stack that already exists it must equal the password the
volume was initialised with, which is the one in that stack's `DATABASE_URL`.

The frontend Dockerfiles have no default for any `NEXT_PUBLIC_*` origin and fail
the build when one is empty, so a build can never silently fall back to
production's URLs. Each compose file passes all of them from its
`x-*-public` block.

`HEROUI_AUTH_TOKEN` has no default either, and it is the one value all three
stacks share: it is HeroUI Pro's CI/CD token, one per licence, copied from
heroui.pro/dashboard by the licence owner (never a developer's personal
token). `@heroui-pro/react` is a stub on npm whose postinstall downloads the
real code with it. Each compose file hands it to the web, app and admin builds
as a BuildKit secret (`secrets: heroui_token`), so it never reaches an image
layer.

That secret is sourced from the variable `HEROUI_AUTH_TOKEN`, and **Compose
before v2.40 reads it from its own process environment only, never from
`--env-file`** (`pkg/compose/build_bake.go`; v2.40.0 is the first release that
looks in the project's env file). So on those versions a token that sits only
in the stack's `.env` never reaches a build. `demo-nightly.sh` and
`deploy-stack.sh` therefore read the value from the stack's `.env` themselves
and put it in the environment of `compose build` alone, whatever the host runs.
The Hangaa VPS runs Compose 5.5.1, which reads the `.env` itself: the demo runs
that failed from the Pro install (`fc51e25`, 2026-10-06) to 2026-10-07 failed
because the demo's `.env` had no token line at all, and the scripts' early
check below is what named it. A build run by hand needs the same, for example
`HEROUI_AUTH_TOKEN=$(sed -n 's/^HEROUI_AUTH_TOKEN=//p' /opt/injishi-demo/.env)
docker compose ... build web`, or an `up --build` with no token fails the same
way.

Unset or `change-me` in the stack's `.env`, both scripts stop before building
with `HEROUI_AUTH_TOKEN is not set in <.env>`, so the running stack is left as
it was. A token that reaches the build but is rejected fails the frontend
install step instead.
It stops there on purpose: BuildKit's layer cache never sees a secret's value,
so an install allowed to finish without the token would be reused, without Pro,
by every later build until the lockfile changed, and so would pnpm's own side
effects cache, which `pnpm-workspace.yaml` turns off for the same reason. CI
reads the same value from the repository secret of that name, the one stack
value GitHub also holds.

## Process order

Compose `depends_on` is the order, the same in all three stacks. Do not invert
it.

1. **Postgres** (`db`), **Redis** and **MinIO** (`minio`, healthy on
   `mc ready local`) become healthy.
2. **`minio-init`** provisions the bucket and the API's user, then exits. It
   must exit 0: the API and the worker wait on
   `service_completed_successfully`, so a failed provisioning stops the release
   before anything boots against a bucket that is not there.
3. **API** starts: `node scripts/migrate.mjs && node dist/main.js` (image
   `WORKDIR` is `/app`; repo-root spelling `node server/api/scripts/migrate.mjs`).
   A failed migration stops the release before it takes traffic. At boot it
   checks the pinned platform against the database's marker and refuses on a
   mismatch. `INJISHI_PROCESS=http`.
4. **Worker** uses the **same image** as the API (`Dockerfile.api`) with
   `INJISHI_PROCESS=worker`, under the same pinned platform and the same check.
   It is not on `dokploy-network`.
5. **App** (port 3002) starts after a healthy API, on the compose network only.
6. **Web** (3000) and **admin** (3001) start after a healthy API. Traefik
   reaches these.

Staging's and the demo's API also wait for their `mailpit` to have started.

## Cookie, CORS and public origins

`NEXT_PUBLIC_*` are compiled into each frontend image, so they are build
arguments, set per stack in its compose file from the host variables.

| Variable | Production | Demo |
| --- | --- | --- |
| `BETTER_AUTH_URL` | `https://api.injishi.com` | `https://api-demo.injishi.com` |
| `AUTH_COOKIE_DOMAIN` | `.injishi.com` | the same |
| `NEXT_PUBLIC_API_URL` | `https://api.injishi.com` | `https://api-demo.injishi.com` |
| `NEXT_PUBLIC_WEB_URL`, `_SITE_URL`, `_PMS_URL` | `https://www.injishi.com` | `https://www-demo.injishi.com` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://admin.injishi.com` | `https://admin-demo.injishi.com` |
| `NEXT_PUBLIC_INJISHI_ENVIRONMENT` | `production` | `demo` |
| `INTERNAL_API_URL` on web, runtime only | `http://injishi-api:8000` | the same, on its own network |

Web's sign-in Server Action calls the API at `INTERNAL_API_URL`, the `api`
service's `injishi-api` alias on the stack's own network, and forwards the
visitor's `x-forwarded-for`. Through the public API host, Traefik would replace
that with the host's own address, and every visitor would share one per-IP send
budget: the fourth sign-in of any minute is refused.

Each API's `CORS_ORIGINS` lists only its own stack's browser origins:
production's `www`, the apex and `admin`; the demo's `www-demo` and
`admin-demo`. It also feeds Better Auth's trusted origins, so an origin missing
here can neither fetch nor sign in.

Every API host must sit under its cookie domain: a response may not set a
cookie for a domain its own host is not in. `BETTER_AUTH_SECRET` and
`COOKIE_SECRET` must be distinct and long in every stack, and never shared
between stacks. `OVERSIGHT_AUTH_SECRET` must not equal `BETTER_AUTH_SECRET` if
it is ever set. Never set `OTP_DEBUG_LOG` on this host.

`HR_PIN_PEPPER` (ADR-058, 058-time AC-TM11) is mixed into every kiosk PIN hash,
so a copy of the PIN table without it is useless to a guesser. Production and
staging compose refuse to start without it and the API refuses a short one; the
demo falls back to a fixed pepper, because its PINs guard sample people only.
Keep it beside the other secrets in each stack's `.env`, distinct per stack.
Changing it invalidates every PIN already set, so each person's PIN must be set
again; losing it has the same effect.

## The self hosted runner

Every workflow that touches this host (`deploy-staging`, `deploy-production`,
`backup`, `schema-capture`, `demo-recover`) runs on ONE repository level
runner labelled `injishi-vps`, installed on the VPS itself. GitHub's hosted
runners cannot reach the stacks; this one lives beside them.

| What | Value |
| --- | --- |
| Runner | repository level on `hangaasoftwares/injishi`, labels `self-hosted`, `Linux`, `X64`, `injishi-vps` |
| User | `gha-runner`: not root, in the `docker` group |
| Home | `/home/gha-runner/actions-runner` |
| Service | `actions.runner.hangaasoftwares-injishi.<runner name>.service`, systemd, enabled |

**The `docker` group is root on this host in all but name**: a job can mount
the host's disk into a container. So the runner is exactly as trustworthy as
write access to the repository, which is why no workflow naming `injishi-vps`
may run on a pull request (`scripts/check-workflow-triggers.mjs`).

**Host settings live in the runner's own `.env`**
(`/home/gha-runner/actions-runner/.env`), which the service exports to every
job, never in a GitHub secret. Restart the service after editing it. On the
Hangaa VPS it holds:

```sh
DEMO_COMPOSE_PROJECT=injishi-demo-rllflw
```

Dokploy names the compose projects it creates, so the demo on this host is
`-p injishi-demo-rllflw`, not the `-p injishi-demo` this file writes
elsewhere. `demo-nightly.sh` and `demo-recover` read the name from this
variable, and `demo-recover` refuses to run when no `db` container carries
it: a wrong name does not fail by itself, it builds a second, empty demo on the
same Traefik routers.

**What it may touch.** `gha-runner` owns `/opt/injishi-demo/src`, the demo's
checkout, and reads `/opt/injishi-demo/.env` (group `gha-runner`, mode
0640). Give it the same two grants on `/opt/injishi-staging` and `/opt/injishi`
when those stacks exist. The build lock `/var/lock/injishi-demo-nightly.lock`
is opened for reading by every script that takes it, so root's cron and this
user share it whichever created the file after a boot.

**The demo's checkout fetches nothing from GitHub.** It holds no credential for
this private repository. `demo-recover` checks the commit out with the job's
own token, and `demo-nightly.sh` fetches it into `/opt/injishi-demo/src` from
that checkout (`STAGING_SRC`), not from origin.

**Installing it** needs an admin on the repository and root on the host:

```bash
# root: the user, and a registration token (valid one hour) from an admin's gh
useradd --create-home --shell /bin/bash --groups docker gha-runner
gh api -X POST repos/hangaasoftwares/injishi/actions/runners/registration-token --jq .token
# gha-runner, in ~/actions-runner: the download and checksum lines GitHub
# prints under Settings → Actions → Runners → New self-hosted runner → Linux x64
./config.sh --url https://github.com/hangaasoftwares/injishi --token <token> \
  --labels injishi-vps --name <host name> --unattended
# root, in /home/gha-runner/actions-runner
./svc.sh install gha-runner && ./svc.sh start
```

**On a demo only host, three of the five jobs fail, and are right to.**
`deploy-staging` finds no `/opt/injishi-staging`; `backup` and
`schema-capture` find no production stack and no `BACKUP_*` settings. Each red
run is the truth about the host, not a pipeline fault, and turns green when
staging and production arrive ([cutover](#cutover-from-the-current-host-state)).

## Releasing

**This is a pipeline now, not an SSH session** ([ADR-052](../../../injishi.context/dox/adrs/052-ci-cd-pipeline/index.md)).
The steps below describe what the workflows do; you trigger the last one.

**The API image is promoted; the frontend images are not.** One API image is
built per green commit on `main` by `.github/workflows/image.yml` and pushed to
`ghcr.io/hangaasoftwares/injishi-api:<short sha>`. Production and staging pull
it by that tag, so the binary staging ran is the binary production runs. The
three frontends bake `NEXT_PUBLIC_*` and `OPERATOR_APP_URL` at image build time,
so their images belong to one stack and are built here, on the host, from that
stack's own compose file.

1. Merge to `main`. `ci` must be green: it is the required status.
2. `image` pushes `injishi-api:<sha>` to GHCR.
3. `deploy-staging` runs on this host with no human step, checks that sha out in
   `/opt/injishi-staging/src`, pulls the API image, builds the three frontends
   and waits for `api` and `web` to report healthy.
4. Test it on staging.
5. Dispatch `deploy-production` with that sha. It refuses unless staging is
   running exactly that commit and a `backup` run has succeeded within
   `BACKUP_MAX_AGE_HOURS`, then does the same sequence against `/opt/injishi`.
   If the stack does not become healthy it puts the previous images back and
   exits non zero.

Both deploys run [`deploy-stack.sh`](deploy-stack.sh), which is also how you do
it by hand:

```bash
bash /opt/injishi-staging/src/infra/docker/deploy-stack.sh --stack staging --commit <sha>
```

**`INJISHI_API_TAG` has no default, on purpose.** The `api` and `worker` services
name `ghcr.io/hangaasoftwares/injishi-api:${INJISHI_API_TAG:?...}`, so a bare
`docker compose up` fails with a message naming the variable rather than
quietly starting something nobody chose. `deploy-stack.sh` sets it from the
commit being deployed. Running compose by hand means exporting it first:

```bash
INJISHI_API_TAG=<short sha> docker compose -p injishi -f infra/docker/docker-compose.dokploy.yml --env-file /opt/injishi/.env ps
```

**A rollback restores images, not schema.** Any migration the failed release
applied is still applied, so the restored image runs against a newer schema than
it shipped with. That makes a rule on the code, which nothing enforces: a
migration shipped beside a risky change stays backward compatible with the
release before it. Add the column, do not rename it; drop it a release later.

The demo follows staging on its own: the night after staging moves, the demo
runs staging's commit. Nothing in a production release touches it, and it is
still built here rather than pulled, which is why its compose file is the one
that did not move to GHCR.

A build compiles three Next apps per stack. Build one stack at a time on this
host; the demo's nightly job runs at 01:00 UTC for that reason, and every deploy
takes the same `/var/lock/injishi-demo-nightly.lock` so the two queue instead of
colliding.

## Cutover from the current host state

The first cutover (September 2026) left production up with routing in
`/etc/dokploy/traefik/dynamic/injishi.yml` and three Dokploy domain rows. To move
to these files:

1. Set every variable from `dokploy.env.example` in `/opt/injishi/.env`,
   including `ADMIN_ALLOWED_IPS`. Storage and mail add five that compose refuses
   to start without: `MINIO_ROOT_PASSWORD`, `MINIO_KMS_SECRET_KEY` (copy it off
   the host before the first `up`), `STORAGE_S3_ACCESS_KEY` and
   `STORAGE_S3_SECRET_KEY` (the API's own MinIO user, never the root pair), and
   `SMTP_URL`, whose relay must already be allowed to send for `MAIL_FROM`'s
   domain. Remove every `DEMO_*` variable, `STORAGE_DEMO_BUCKET`,
   `INJISHI_WORKER_ENVIRONMENT` and any `RESEND_*` left over: nothing reads them.
2. Delete `/etc/dokploy/traefik/dynamic/injishi.yml` and the Dokploy domain rows
   for `www.injishi.com`, `injishi.com` and `api.injishi.com` in the same step as
   the next `up`, so no host has two routers.
3. `up -d --build` the production file. The database volume names are unchanged,
   so production data carries over, and migration 0030 adds only an empty
   `database_identity` table, which is what a real database is. Uploads do not
   carry over: anything the running stack stored went through the local-disk
   adapter, onto the API container's disk under `STORAGE_LOCAL_ROOT`. Object
   keys are the same in both adapters, so copying those files into the
   `injishi` bucket keeps their `stored_objects` rows good; skip that and the
   rows point at nothing.
4. Point DNS (below), including `storage.injishi.com`, which every signed URL
   names. Then confirm each host serves over trusted TLS.
5. Register the staging domain, create `/opt/injishi-staging`, set its own
   values from `dokploy-staging.env.example`, and bring staging up the first
   time as [above](#first-bring-up-of-a-sample-stack).
6. Create `/opt/injishi-demo` with its own `.env` from
   `dokploy-demo.env.example` and a clone at `/opt/injishi-demo/src`, run
   `demo-nightly.sh` once by hand, then install its cron line.

## DNS

Public DNS still points at **Vercel** (web / app) and **Railway** (API) until
cutover. Neither is a deployment path any more: ADR-052 deleted `railway.json`,
`railpack.json` and `.railwayignore`, so nothing in this repository configures
either one, and the pipeline in `.github/workflows/` deploys only to this VPS.
What is still true is the DNS, and only until these names resolve here. The
running Railway service is unaffected; `server/api/RAILWAY.md` keeps the record
of what it was.

These names must resolve to this VPS, DNS only (not proxied):

| Name | Type | Target |
| --- | --- | --- |
| `injishi.com` (apex) | A | `102.202.208.167` |
| `www.injishi.com` | A | `102.202.208.167` |
| `app.injishi.com` | A | `102.202.208.167` |
| `api.injishi.com` | A | `102.202.208.167` |
| `admin.injishi.com` | A | `102.202.208.167` |
| `storage.injishi.com` | A | `102.202.208.167` |
| `www-demo.injishi.com` | A | `102.202.208.167` |
| `app-demo.injishi.com` | A | `102.202.208.167` |
| `api-demo.injishi.com` | A | `102.202.208.167` |
| `admin-demo.injishi.com` | A | `102.202.208.167` |
| `storage-demo.injishi.com` | A | `102.202.208.167` |
| `mail-demo.injishi.com` | A | `102.202.208.167` |
| `www`, `app`, `api`, `admin`, `storage`, `mail` under `STAGING_DOMAIN` | A | `102.202.208.167` |

TLS is Traefik's, per host, once a record reaches this host.

## Restoring from a backup

`.github/workflows/backup.yml` ships two encrypted files per run to
`BACKUP_DESTINATION`: a `pg_dump` custom format dump of the database, and a tar
of the `minio-data` volume. The tool chain is fixed by ADR-052 so that the
backup and this restore cannot disagree: `pg_dump`/`pg_restore`, `tar`, `age`,
`rclone`.

**Three keys, and none of them lives only on this VPS.** Losing any one of them
makes the copies useless, which is the whole point of keeping them elsewhere:

| Key | What it opens | Where it is kept |
| --- | --- | --- |
| the `age` identity | the two copies | off the VPS, with the destination credentials |
| `MINIO_KMS_SECRET_KEY` | every object in the restored bucket | off the VPS, **beside the copies** |
| `BACKUP_ENCRYPTION_RECIPIENT` | nothing; it is the public half | the deploy user's environment |

The VPS holds the recipient only, so it can write a backup it cannot read.

Restore into a **scratch stack**, never over the running one:

```bash
# 1. Fetch one night's pair.
rclone copy "$BACKUP_DESTINATION/2026/09" ./restore --include 'injishi-2026*'

# 2. Decrypt with the identity kept off this host.
age --decrypt --identity ~/age-identity.txt --output injishi.dump injishi-<stamp>.dump.age
age --decrypt --identity ~/age-identity.txt --output minio.tar.gz  minio-<stamp>.tar.gz.age

# 3. Bring a scratch stack up on its own project name and .env, with
#    MINIO_KMS_SECRET_KEY set to the value that was current when the backup ran.
docker compose -p injishi-restore -f infra/docker/docker-compose.staging.yml --env-file /opt/injishi-restore/.env up -d db minio

# 4. The database. --clean --if-exists so a repeat run is not a new failure.
docker compose -p injishi-restore ... exec -T db \
  pg_restore --clean --if-exists --no-owner --no-privileges -U injishi -d injishi < injishi.dump

# 5. The objects, back onto the volume.
docker run --rm -v injishi-restore_minio-data:/data -v "$PWD":/in alpine:3 \
  tar -xzf /in/minio.tar.gz -C /data

# 6. Bring the rest up and sign in as a seeded account.
docker compose -p injishi-restore ... up -d
```

**It is not a backup until you have restored it.** AC-20 asks for exactly one
proven restore: a scratch stack, brought up from these copies, serving a signed
in session, with an object referenced by `stored_objects` actually resolving.
Record the date of the last proven restore here when you do it:

> Last proven restore: **never**. Do this before real data depends on it.

## Known gaps

- **Production cannot take a booking payment.** `PAYMENT_ADAPTER_MODE=off` until
  an MTN MoMo or Airtel Money provider is chosen, contracted and given
  credentials, and a live adapter is registered behind the payment seam. Until
  then every guest checkout on production answers "nothing has been charged".
- **Backups exist but have never run, and no restore has been proven.**
  `.github/workflows/backup.yml` is written and scheduled, and
  `deploy-production.yml` refuses to release when its newest successful run is
  older than `BACKUP_MAX_AGE_HOURS`. Neither has run: production does not serve
  from this VPS yet. Until one does, the production deploy gate will refuse
  every dispatch, which is the correct direction to fail in. Staging and the
  demo need no backup: they are rebuilt from the recipe.
- **MinIO gets no more security fixes, and can no longer be pulled.** `quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z`
  is the last community release: upstream publishes no further community builds,
  so a vulnerability found after it stays open here, in all three stacks. The
  exposure is kept small (reads only on the public hosts, console off, the API on
  a scoped user), not removed. Choose a maintained S3 server, or a paid MinIO
  build, before this store holds a volume of personal documents worth attacking.
  Since at least 2026-09-25 quay.io also answers 401 to anonymous pulls of
  `quay.io/minio/minio` and `quay.io/minio/mc`, and Docker Hub had already
  dropped both. Only a host that already holds the server image can start
  MinIO; `minio-init` now runs from that same image, which ships `mc`,
  because the separate `mc` image had been pruned from the demo host and its
  nightly `up` failed on the pull five nights running, leaving the API
  stopped. A fresh host (staging's or production's first bring up, or a laptop
  on `docker-compose.yml`'s `:latest`) cannot pull it at all: `docker save`
  a copy from a host that has it and `docker load` it, or choose the
  replacement first.
- **Postgres and Redis float on their major tags** (`postgres:17-alpine`,
  `redis:7-alpine`), so a fresh host or a `docker compose pull` can bring a
  newer minor release than the one staging tested. MinIO and
  `axllent/mailpit:v1.31.1` are pinned to exact releases; moving one is a
  deliberate edit, tried on staging first like any release.
- **Reference data for a real database.** Geography and the RDB classification
  catalogue arrive through `seed-geography.mjs` and `seed-content.mjs`, which
  refuse any database without the sample marker, so production has no
  documented way to load them. It never had one; how a real database gets its
  reference rows is an open decision.

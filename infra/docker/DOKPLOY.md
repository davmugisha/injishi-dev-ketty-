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
| **Demo** | The public showroom: staging's commit, sample data, a published sign in code, rebuilt every night | [`docker-compose.demo.yml`](docker-compose.demo.yml) | `-p injishi-demo`, `/opt/injishi-demo/.env`, `/opt/injishi-demo/src` at staging's commit |

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

| Stack | `INJISHI_ENVIRONMENT` | `INJISHI_DATABASE_KIND` | Frontend build `NEXT_PUBLIC_INJISHI_ENVIRONMENT` |
| --- | --- | --- | --- |
| Production | `production` | `real` | `production` |
| Staging | `production` | `sample` | `production` |
| Demo | `demo` | `sample` | `demo` |

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
roster includes the staff persona `ops@demo.injishi.rw` (`StaffRole` `ops`),
which opens `admin-demo` after the step up.

**How it is kept apart from production.**

| Concern | Production | Demo |
| --- | --- | --- |
| Stack | `-p injishi` | `-p injishi-demo`, its own everything |
| Database | `db` volume, no sample marker | its own `db`; the live database is `injishi_demo`, marked sample |
| Redis | persistent | its own, no persistence, flushed nightly |
| Object storage | `minio`, `storage.injishi.com` | its own `minio`, own KMS key and API user, `storage-demo.injishi.com`, emptied nightly |
| Mail | the relay in `SMTP_URL` | its own `mailpit`, no volume, emptied nightly; no relay credential in its env file |
| Session secret | `BETTER_AUTH_SECRET` | its own `BETTER_AUTH_SECRET` |
| Session cookie name | `better-auth.session_token` | `injishi-demo.session_token` (and `injishi-oversight-demo.*` for the console) |
| Adapters | as configured | pinned to mock; a `demo` process refuses live payments or live EBM at boot |
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
0 1 * * * /opt/injishi-demo/src/infra/docker/demo-nightly.sh >> /var/log/injishi-demo-nightly.log 2>&1
```

In order, stopping at the first failure: check out staging's commit in
`/opt/injishi-demo/src`; build every demo image as `:demo-next`; create
`injishi_demo_next` and migrate, mark and seed it with the candidate API image;
then, only when all of that succeeded, swap (stop the demo, rename the live
database to `injishi_demo_prev` and the candidate to `injishi_demo`, retag the
images, empty the bucket, flush Redis, empty Mailpit, start the demo) and wait
for the API and web health checks. Healthy, it drops the previous database and
images. Not healthy within ten minutes, it swaps the previous database and
images back and exits non zero. A failure before the swap drops the candidate
and leaves yesterday's demo running untouched.

The job reads no secret itself, holds a lock so two runs never overlap, and
logs one line per step to `/var/log/injishi-demo-nightly.log`. A presenter
should know that the demo runs code production has not released: the job
guards against a broken build or seed, not a broken screen.

**Reseeding by hand**, without rebuilding, keeps the images and reruns the
recipe against the live database:

```sh
cd /opt/injishi-demo/src && docker compose -p injishi-demo -f infra/docker/docker-compose.demo.yml \
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
  (`minio/mc`, running [`minio/provision.sh`](minio/provision.sh)) runs on every
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

Each API's `CORS_ORIGINS` lists only its own stack's browser origins:
production's `www`, the apex and `admin`; the demo's `www-demo` and
`admin-demo`. It also feeds Better Auth's trusted origins, so an origin missing
here can neither fetch nor sign in.

Every API host must sit under its cookie domain: a response may not set a
cookie for a domain its own host is not in. `BETTER_AUTH_SECRET` and
`COOKIE_SECRET` must be distinct and long in every stack, and never shared
between stacks. `OVERSIGHT_AUTH_SECRET` must not equal `BETTER_AUTH_SECRET` if
it is ever set. Never set `OTP_DEBUG_LOG` on this host.

## Releasing

Frontend images differ per stack, so an image is never promoted from staging to
production. The **git commit** is:

1. Check out the commit in `/opt/injishi-staging/src` and bring staging up.
2. Test it there.
3. Check out the same commit in `/opt/injishi/src` and bring production up. That
   rebuilds the production images from exactly what was tested.

The demo follows staging on its own: the night after staging moves, the demo
runs staging's commit. Nothing in a production release touches it.

A build compiles three Next apps per stack. Build one stack at a time on this
host; the demo's nightly job runs at 01:00 UTC for that reason.

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
cutover. These names must resolve to this VPS, DNS only (not proxied):

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

## Known gaps

- **No backups.** Nothing dumps production's `db` or copies its `minio-data`
  volume off this host. Schedule both off-host, keep `MINIO_KMS_SECRET_KEY` with
  them (objects restored without it are unreadable), and test a restore before
  real data depends on it. Staging and the demo need none: they are rebuilt
  from the recipe.
- **MinIO gets no more security fixes.** `minio/minio:RELEASE.2025-09-07T16-13-09Z`
  is the last community release: upstream publishes no further community builds,
  so a vulnerability found after it stays open here, in all three stacks. The
  exposure is kept small (reads only on the public hosts, console off, the API on
  a scoped user), not removed. Choose a maintained S3 server, or a paid MinIO
  build, before this store holds a volume of personal documents worth attacking.
- **Postgres and Redis float on their major tags** (`postgres:17-alpine`,
  `redis:7-alpine`), so a fresh host or a `docker compose pull` can bring a
  newer minor release than the one staging tested. MinIO, `minio/mc` and
  `axllent/mailpit:v1.31.1` are pinned to exact releases; moving one is a
  deliberate edit, tried on staging first like any release.
- **Reference data for a real database.** Geography and the RDB classification
  catalogue arrive through `seed-geography.mjs` and `seed-content.mjs`, which
  refuse any database without the sample marker, so production has no
  documented way to load them. It never had one; how a real database gets its
  reference rows is an open decision.

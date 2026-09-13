> **Retired as the live host.** Railway is no longer the intended production
> runtime for `server/api`. This file is superseded by
> [`../../infra/docker/DOKPLOY.md`](../../infra/docker/DOKPLOY.md), which owns
> VPS / Dokploy deploy facts. Public DNS may still point at Railway until
> cutover; that is not the same as Railway remaining the owner of how we host.
> Cookie, CORS, and sibling-zone lessons below still apply on Dokploy.

# Deploying server/api to Railway (retired)

Two Railway services ran from this one repo and one build: the **API** (HTTP)
and the **worker** (BullMQ). They differ by start command and nothing else, so
a queue can never run code the HTTP process did not ship. Dokploy keeps the
same split (`INJISHI_PROCESS=http` vs `worker` on one image); see
[DOKPLOY.md](../../infra/docker/DOKPLOY.md).

Both need a Postgres and a Redis. On Railway those came from Railway's own
catalogue, referenced as variables — do not paste connection strings, or a
rotated credential silently breaks the deploy. On Dokploy the same names live
in the environment store, not in this file.

## 1. Build settings (both services)

Historical Railway dashboard values. Dokploy builds from
`infra/docker/Dockerfile.api`, not Railpack.

| Setting | Value |
| --- | --- |
| Root Directory | `/` — the repo root, **not** `server/api` |
| Builder | Railpack (already set in `railway.json`) |

The root directory has to be the repo root. `@injishi/api` depends on
`packages/auth` and `packages/contracts` through `workspace:*`, and pnpm can only
resolve those with `pnpm-workspace.yaml` and the lockfile in the build context.
Point the builder at `server/api` and the install fails on the first dependency.

Three files drove the Railway build. Nothing else needed setting in the
dashboard:

- [`railway.json`](../../railway.json) — builder, health check, the pre-deploy
  migration, restart policy.
- [`railpack.json`](../../railpack.json) — the build command and the start
  command. Railpack detects the pnpm workspace and writes the install step
  itself; only the build is overridden, because the root `build` script builds
  the two Next apps as well and this service needs neither.
- [`mise.toml`](../../mise.toml) — pins Node and pnpm.

## 2. Variables

Required. The API **refuses to boot** without the starred ones rather than fall
back to a permissive default, which is deliberate. Production values for the
Dokploy host are owned by [DOKPLOY.md](../../infra/docker/DOKPLOY.md); the
table below is the Railway-era shape and the reason each name exists.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `NODE_ENV` | `production` |
| `COOKIE_SECRET` * | 32+ chars — `openssl rand -base64 32` |
| `BETTER_AUTH_SECRET` * | 32+ chars, **different** from the above |
| `BETTER_AUTH_URL` | the API's public URL, e.g. `https://api.injishi.rw` |
| `CORS_ORIGINS` * | every browser origin that calls this API, comma separated |
| `AUTH_COOKIE_DOMAIN` | the parent domain the apps share, e.g. `.injishi.com` |

`CORS_ORIGINS` is a real interface, not incidental config. An app whose origin
is missing cannot fetch **and** cannot authenticate, and the symptom is a 404
that never mentions CORS. Include every browser origin the product actually
serves. A Railway-era example:

```
https://injishi.rw,https://pms.injishi.rw,https://pms.demo.injishi.rw
```

Do not set `PORT`. Railway injected it and the server reads it. Dokploy /
compose set the listen port in the image contract instead.

Optional, and covered in [`.env.example`](.env.example): `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `DEMO_DATABASE_URL`, `DEMO_HOSTNAMES`,
`OVERSIGHT_HOSTNAMES`, `OVERSIGHT_AUTH_SECRET`, `LOG_LEVEL`.

Mail changed after this host was retired. The Railway deploy sent codes through
the Resend SDK; the API now sends through an SMTP relay named in `SMTP_URL`
(sender `MAIL_FROM`) and **refuses to boot** under `NODE_ENV=production`
without it. Nothing reads the old Resend variables. Object storage likewise
has a live mode on MinIO now (`STORAGE_ADAPTER_MODE=live` and the
`STORAGE_S3_*` settings). Both are configured for the Dokploy host in
[DOKPLOY.md](../../infra/docker/DOKPLOY.md).

Never set `OTP_DEBUG_LOG` on a deployed host. A printed OTP is a working
credential. It is force-disabled when `NODE_ENV=production`, and that is a
backstop, not permission.

## 2b. The API must live on the apps' own domain

This section is why a platform-generated hostname cannot carry a session. It
was written for Railway's `*.up.railway.app`; the same failure happens on any
foreign host (Dokploy Traefik included) if the API is not a sibling under
`.injishi.com`.

**A Railway-generated `*.up.railway.app` hostname cannot carry a session.** The
API can answer from one, and every health check and CORS preflight will pass
while nobody can stay signed in — which is why this is written down rather than
discovered.

Better Auth writes a host-only cookie with `SameSite=Lax`. Against apps on
`injishi.com` that fails twice, and each failure hides the other:

- `Lax` is never returned on a cross-**site** request, so the browser will not
  carry the cookie from `www.injishi.com` to an API on `*.up.railway.app`. The
  sign-in call answers 200 and the next request is anonymous.
- Host-only means the cookie is not delivered to any other host either. The pms
  app's Next.js middleware reads the cookies sent to **its own** origin before
  it renders, so it cannot see a cookie belonging to the API's host — and it
  bounces a signed-in operator back to sign-in, forever.

Fixing only the first (widening `SameSite` to `None`) still leaves pms looping.
Both are answered by putting the API on a sibling subdomain and naming the
parent:

1. **DNS** — add a name for `api.injishi.com` at the registrar. On Railway that
   was a `CNAME` at the target Railway showed you. After cutover, [DOKPLOY.md](../../infra/docker/DOKPLOY.md)
   owns the A records to the VPS; they are required for cutover and are not
   flipped yet while this file is still describing the Railway era.
2. **Railway (historical)** — API service → Settings → Networking → Custom
   Domain → `api.injishi.com`.
3. **Variables** — `BETTER_AUTH_URL=https://api.injishi.com`,
   `AUTH_COOKIE_DOMAIN=.injishi.com`, and add `https://api.injishi.com` to
   `CORS_ORIGINS`.
4. **Frontends** — `NEXT_PUBLIC_API_URL=https://api.injishi.com` on the web and
   operator apps, then rebuild each. It is inlined at build time, so changing
   the variable alone does nothing. On Vercel that meant redeploying the
   projects; on Dokploy it means rebuilding the images.

`AUTH_COOKIE_DOMAIN` only works while the API is served from that domain: a
response may not set a cookie for a domain its own host is not in, and the
browser drops it with no error. Set the two together or neither.

## 3. The worker service

Same repo, same build, same start command. It boots as the worker because of
ONE variable:

```
INJISHI_PROCESS=worker
```

`isWorkerProcess()` reads either that variable or a `--worker` flag, so nothing
in the dashboard has to be overridden — which matters, because the start command
comes from `railpack.json` and is shared by both services. Give it a public
domain and it will still answer nothing: the worker opens no HTTP port.

Its other variables reference the API service, so the two can never drift:

```
BETTER_AUTH_SECRET=${{api.BETTER_AUTH_SECRET}}
BETTER_AUTH_URL=${{api.BETTER_AUTH_URL}}
CORS_ORIGINS=${{api.CORS_ORIGINS}}
```

`BETTER_AUTH_SECRET` and `CORS_ORIGINS` are not optional here even though the
worker serves no HTTP. `AuthModule` builds its Better Auth instances in every
process, and that factory calls `getOrThrow('BETTER_AUTH_SECRET')` and
`resolveAllowedOrigins`, which throws in production on an empty list.

Do not give the worker a health check. It opens no port, so a check can only
fail and restart a process that is working.

## 4. Migrations

`railway.json` sets `preDeployCommand` to `node server/api/scripts/migrate.mjs`.

**Railway did not apply it from the file.** On the first deploy the setting came
back `null` in the deployment manifest and the database was left with no tables;
`/api/v1/geography/provinces` answered 500 with `relation "provinces" does not
exist`. Set it by hand instead, once, on the API service:

> Settings -> Deploy -> Pre-deploy Command:
> `node server/api/scripts/migrate.mjs`

Same for Healthcheck Path (`/api/v1/health`), which was ignored the same way.
Leave both in `railway.json` regardless — they are the correct declaration, and
a Railway release may start honouring them.

The script uses the migrator from `drizzle-orm` — a runtime dependency — and
not `drizzle-kit`, which is a devDependency. Drizzle records what it applied in
`drizzle.__drizzle_migrations`, so re-running is a no-op.

To run one by hand on Railway:

```
railway ssh --service api node server/api/scripts/migrate.mjs
```

Dokploy runs migrate as part of the API container start
(`node scripts/migrate.mjs && node dist/main.js` with `WORKDIR` `/app`). That
command is owned by [DOKPLOY.md](../../infra/docker/DOKPLOY.md).

## 4b. The demo environment (fixed sign-in code)

> **Superseded by ADR-043.** Everything in this section describes the old in
> process split, and the code no longer has it: `DEMO_DATABASE_URL` and
> `DEMO_HOSTNAMES` are read by nothing. A process is production or demo for
> its whole life, from `INJISHI_ENVIRONMENT`, and a demo process boots only on a
> database carrying the sample marker. **A redeploy of this Railway project
> with current code runs as production** (`NODE_ENV=production`, no
> `INJISHI_ENVIRONMENT`) against `DATABASE_URL`, not `Postgres-Egrf`, and issues
> random codes. The demo is now its own Dokploy stack; see
> [DOKPLOY.md](../../infra/docker/DOKPLOY.md) § The demo. Kept below as the
> record of how this deployment was left.

The demo environment issues ONE fixed sign-in code — `123456`, a constant in
`@injishi/auth` — so the product can be walked with no mailbox.

It is not a flag. `AuthModule` builds a SEPARATE Better Auth instance per
environment and hands the fixed code only to the demo one, so no variable can
make the production instance issue it. What the variables below decide is
whether a demo instance is built at all, and which hostnames reach it.

**In production a demo needs its own database.** `isDemoConfigured` requires
`DEMO_DATABASE_URL` to be set AND to differ from `DATABASE_URL`, and returns
false otherwise — no demo instance, no fixed code. That is the point: a
published sign-in code must not sit beside real rows.

| Variable | Value |
| --- | --- |
| `DEMO_DATABASE_URL` | `${{Postgres-Egrf.DATABASE_URL}}` — a SECOND Postgres |
| `DEMO_HOSTNAMES` | the API hostnames served as demo, comma separated |

`DEMO_HOSTNAMES` lists hostnames of **this API**, not of the apps. The
environment is resolved from the `Host` header of the API request, because a
hostname is the one boundary a misconfigured deploy cannot straddle. An
unlisted host is production, always — a typo costs you the demo, never the
other way round.

So `DEMO_HOSTNAMES=api.injishi.com` makes the WHOLE deployment a demo: every
app pointing at `api.injishi.com` reads the demo database, and the production
Postgres is unreachable through this API. To serve both at once, give the
service a second custom domain and list only that one.

### Seeding it

The pre-deploy migration only ever runs against `DATABASE_URL`, so the demo
database gets nothing automatically. Every script reads `DATABASE_URL`, so
point that at the demo one for the duration of the command:

```
railway ssh --service api sh -c 'DATABASE_URL="$DEMO_DATABASE_URL" node server/api/scripts/migrate.mjs'
railway ssh --service api sh -c 'DATABASE_URL="$DEMO_DATABASE_URL" node server/api/scripts/seed-geography.mjs'
railway ssh --service api sh -c 'DATABASE_URL="$DEMO_DATABASE_URL" node server/api/scripts/seed-content.mjs'
railway ssh --service api sh -c 'DATABASE_URL="$DEMO_DATABASE_URL" node server/api/scripts/seed-users.mjs'
```

Order matters, and only the last one says so. `seed-users.mjs` grants the Host
workspace by looking up the hospitality org that `seed-content.mjs` creates,
and files the oversight assignment against a district that `seed-geography.mjs`
creates. Run it first and it still succeeds — with `host@injishi.com` and
`localgov@injishi.com` holding nothing, which is indistinguishable from a
broken sign-in until you read the log.

## 5. Health check

`GET /api/v1/health` → `{"status":"ok","uptimeSeconds":N}`

Not `/health`. The app sets a global `api` prefix and URI versioning, so every
route carries `/api/v1`.

## 6. First deploy (Railway, historical)

```
railway login
railway link          # pick or create the project
railway up            # builds with Railpack and deploys
railway logs
```

New production deploys go through Dokploy, not these commands.

## Known gotchas

- **Railway's private network is IPv6-only.** ioredis defaults to IPv4, so
  `redis.railway.internal` never resolves and the client retries forever
  without saying why. `family: 0` in `src/shared/queues/redis.config.ts` is what
  fixes it — do not "tidy" it away. Keep dual-stack on any host whose Redis
  might be IPv6-only.
- **`REDIS_URL`, not the host/port pair.** Managed Redis hands out one URL
  carrying host, port, user and password. Setting only `REDIS_HOST`/`REDIS_PORT`
  points the queues at `127.0.0.1`, which connects to nothing and looks healthy.
- **`.dockerignore` must not exclude `packages/`.** It is only used by
  `infra/docker/Dockerfile.api` (the local/compose and now Dokploy path, not
  Railway), but `packages/*/dist` IS the built package — a bare `**/dist` rule
  there costs 90 TS2307 errors at `nest build`.

## The Docker path

[`infra/docker/Dockerfile.api`](../../infra/docker/Dockerfile.api) still builds
the same service and is what `infra/docker/docker-compose.yml` uses locally.
Railway does not use it. Dokploy does — see
[DOKPLOY.md](../../infra/docker/DOKPLOY.md). Keep the image in step if the
build ever changes.

## Live deployment (project `injishi-api`, Railway era)

This table is how the Railway project was left, not a claim that Dokploy
already answers public DNS. Until cutover, those names may still resolve here.

| Service | State | URL |
| --- | --- | --- |
| api | online (Railway) | https://api.injishi.com (also injishi-api.up.railway.app) |
| worker | online (Railway) | no port, by design |
| Postgres | online | production rows; private network only |
| Postgres-Egrf | online | DEMO rows; private network only |
| Redis | online | private network only |

`api.injishi.com` is the domain that matters. It is the one the apps call, the
one `BETTER_AUTH_URL` names, and — because it is a sibling of `www.` and
`app.` — the only one a session cookie can be shared from. See §2b.

`DEMO_HOSTNAMES=api.injishi.com`, so this Railway deployment IS the demo: it
reads `Postgres-Egrf` and issues the fixed code `123456`. The production
Postgres is not reachable through it. Serving both would need a second custom
domain on the same service, listed in neither or one of the two lists.

The Vercel apps were pinned to it: `NEXT_PUBLIC_API_URL=https://api.injishi.com`
on both `injishi-web` and `injishi.app`. That value is inlined at BUILD time, so
changing it means rebuilding each app, not just editing the variable. The
retired Vercel record, `apps/VERCEL.md`, is no longer on disk.

### Seeded demo accounts

All six sign in with `123456`. Seeded by §4b, in that order.

| Email | What it opens |
| --- | --- |
| `admin@injishi.com` | personal + platform staff (super_admin) |
| `host@injishi.com` | personal + Umurage Hospitality Ltd (owner) |
| `landlord@injishi.com` | personal + Kigali Heights Residences (owner) |
| `broker@injishi.com` | personal + broker |
| `guest@injishi.com` | personal only |
| `localgov@injishi.com` | personal + district oversight assignment |

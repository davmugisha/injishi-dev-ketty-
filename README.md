# Injishi

Hospitality and property platform for Rwanda: a public marketplace where guests
find and book a stay, and the backend that serves it.

This repository holds three deployable things and the shared code they use:

| Path           | Package        | What it is                                          |
| -------------- | -------------- | --------------------------------------------------- |
| `apps/web`     | `@injishi/web` | Next.js 15 marketplace + signed-in guest app        |
| `apps/app`     | `@injishi/app` | Next.js 15 operator app, served as a zone under web |
| `server/api` | `@injishi/api` | NestJS 11 modular monolith on Fastify, plus worker  |
| `packages/*`   | `@injishi/*`   | The five shared packages. Source, not a mirror (ADR-034) |

> **Scope note.** The wider product also has an admin console and a mobile app.
> They are not in this repository. Do not add an `apps/admin` or `apps/mobile`
> here on the assumption that they belong; they are tracked elsewhere.

## The operator app is a zone, not a second origin

`apps/app` runs on its own port (`:3002`) and has its own build and deploy, but
the browser never sees that origin. `apps/web/next.config.ts` rewrites `/w`,
`/oversight`, `/host`, `/landlord` and `/broker` — plus `/operator-static/*`
for its chunks — to `OPERATOR_APP_URL`. One product, one sign-in, one cookie
jar, two code bases. `assetPrefix` is what keeps the two `/_next` trees apart on
the shared origin.

In development the zone's hot-reload socket does not cross the rewrite. Open
<http://localhost:3002> directly when you are editing the operator app.

---

## Requirements

- **Node** `>=20.19` (CI runs 22)
- **pnpm** `10.33.2` — the version is pinned in `package.json` via `packageManager`
- **PostgreSQL 17** — local, or the container in `infra/docker/docker-compose.yml`
- **Redis** — only if you run the BullMQ worker
- **MinIO and Mailpit** — `server/api/.env.example` stores uploads on a local
  MinIO (`STORAGE_ADAPTER_MODE=live`) and sends mail to a local Mailpit
  (`SMTP_URL=smtp://localhost:1025`, inbox at <http://localhost:8025>). Both run
  from `infra/docker/docker-compose.yml`. `STORAGE_ADAPTER_MODE=local` and an
  unset `SMTP_URL` with `OTP_DEBUG_LOG=true` run the API without either

## Quick start

```bash
pnpm install                                  # always from the repository root
cp server/api/.env.example server/api/.env    # once: the API's settings, local-ready
pnpm dev:all                                  # the whole product, in this terminal
```

`pnpm dev:all` starts Docker Desktop when it is not running, brings up
Postgres, Redis, MinIO and Mailpit, migrates (seeding only a database that was
never seeded), then runs every app with each line labelled by its app: web on
:3000, the operator app on :3002, the API on :8000 with its queue worker, and
mobile for Expo Go, with a QR code to scan on your phone. The
API runs as the demo, so every sign-in code is `123456`. Ctrl+C stops the apps;
Docker keeps running until `pnpm dev:stack:down`. `pnpm dev:all --skip mobile`
or `--only web,api` start fewer. Installing Docker, and what the stack does, is
`infra/docker/README.md`.

Open <http://localhost:3000>. The operator surfaces are reached through that
same origin — `/w`, `/oversight`, `/host`, `/landlord`, `/broker`. Health check
for the API is <http://localhost:8000/api/v1/health>.

`pnpm dev` starts web and the operator app only: no API, worker or Docker
services.

`infra/docker/docker-compose.yml` holds the backing services only. The apps run
on the host, with hot reload; the header of that file says why. The stack built
from the production images is `docker-compose.staging.yml`.

---

## Repository layout

```text
apps/web/               Next.js app router, React 19, Tailwind 4, HeroUI 3
  src/app/(marketplace) public surfaces — no session required
    (site)              home, property pages, guides, host, legal, support
    (results)           explore / search results
    (checkout)          booking flow
  src/app/(app)         session surfaces
    (entry)             sign-in, verify-otp, register, activate, claim-org
    (shell)             account, inbox, trips, saved, lease
  src/middleware.ts     edge gate: verifies the session cookie, bounces to /sign-in
  src/data/             API clients and fixture data per domain
  src/lib/              session, otp, redirect allowlist and other helpers

apps/app/               Operator app. Same stack, served as a zone under web.
  src/app/w/            the operator workspace shell
  src/app/oversight/    the government oversight console
  src/app/host|landlord|broker/  legacy kind roots, kept as redirect targets
  src/pms/              store (one reducer per domain), nav, client-side authz
  src/middleware.ts     edge gate, same contract as web's

server/api/
  src/main.ts           one entry point; --worker flips it to the queue process
  src/api/public/       HTTP controllers: health, properties, inventory, bookings,
                        geography, me, ops, oversight, registrations, uploads
  src/api/admin/        staff-facing controllers
  src/modules/          domain modules: auth, booking, ebm, geography, listing,
                        listing-setup, mailer, operations, organization,
                        payments, sms, storage, user
  src/database/drizzle/ schema by domain + SQL migrations
  src/shared/           guards, config, http, queues, validation, process role

packages/               SOURCE of @injishi/auth, contracts, design-tokens,
                        ui, utils. Edit directly.
tools/eslint-rules/     flat-config ESLint plugin, no build step
infra/docker/           Dockerfile.api, Dockerfile.web, docker-compose.yml
scripts/                content and image generation utilities
```

### About `packages/`

`packages/*` holds the five shared packages and **is their source**.
`pnpm-workspace.yaml` globs it, which is what lets the apps keep `workspace:*`
dependencies.

It was called `vendor/` and it was a build-output mirror of a second repository,
`injishi.managed`, kept here so this one could build standalone. That repository
is deleted; these are the only copies. [ADR-034](../injishi.context/dox/adrs/034-vendor-becomes-source.md)
records the change and renamed the directory to say so — a directory called
`vendor` is a directory nobody edits, which is the wrong instruction to leave on
the only copy of a design system.

**Edit them directly.** Two carry a build:

- `@injishi/design-tokens` — edit `src/*.ts`, then
  `pnpm -F @injishi/design-tokens build && pnpm -F @injishi/design-tokens generate:css`.
  `pnpm -F @injishi/design-tokens check` fails if `dist/` or `generated/` drifts
  from `src/`, which is the local replacement for the deleted `pnpm vendor:check`.
- `@injishi/auth` and `@injishi/contracts` ship only `dist/` and carry source
  debt until ADR-034 task 8 reconstructs them by the same method. Until then a
  change there is a hand edit to compiled JS **and** its `.d.ts`.

`@injishi/ui` and `@injishi/utils` are TypeScript source, compiled by the
consuming Next app through `transpilePackages` (ADR-008).

---

## Configuration

Copy `.env.example` to `.env`. Nothing in `.env` is committed.

### Read by the browser (public)

| Variable                    | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`      | Canonical origin of the web app             |
| `NEXT_PUBLIC_API_URL`       | Where the browser reaches the API           |
| `NEXT_PUBLIC_WEB_URL`       | Web origin, for the sign-in redirect allowlist |
| `NEXT_PUBLIC_PMS_URL`       | Operator origin, same allowlist             |
| `NEXT_PUBLIC_ADMIN_URL`     | Admin origin, same allowlist                |
| `NEXT_PUBLIC_DEMO_LISTING`  | Optional listing id used by demo surfaces   |

The three `*_URL` allowlist values are matched by **exact origin**. Suffix
matching is deliberately not used — `injishi.rw.evil.com` would pass it, and an
open redirect on the sign-in screen hands a phishing page a live session.

### Read by the server only

| Variable                                | Purpose                                          |
| --------------------------------------- | ------------------------------------------------ |
| `NODE_ENV`                              | `development` / `production`                     |
| `PORT`                                  | API listen port (default 4000)                   |
| `DATABASE_URL`                          | Postgres connection string                       |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Session signing and issuer for the main instance  |
| `COOKIE_SECRET`, `AUTH_COOKIE_DOMAIN`   | Cookie signing and scope                         |
| `CORS_ORIGINS`                          | Comma-separated allowed origins                  |
| `GOOGLE_CLIENT_ID` / `_SECRET`          | Google sign-in                                   |
| `SMTP_URL`, `MAIL_FROM`                 | Outgoing email through the mailer seam (nodemailer over SMTP): Mailpit locally, a relay deployed. Required in production |
| `OVERSIGHT_AUTH_SECRET`, `_BASE_URL`, `_COOKIE_NAME`, `OVERSIGHT_HOSTNAMES` | Second auth instance for the government oversight surface |
| `INJISHI_ENVIRONMENT`, `INJISHI_DATABASE_KIND` | Which platform this process is (`production` or `demo`) and what its database must be (`real` or `sample`). Unset locally, so a laptop runs as the demo; pinned in each deploy compose file (ADR-043) |
| `PAYMENT_ADAPTER_MODE`, `STORAGE_ADAPTER_MODE`, `RRA_TIN_ADAPTER_MODE`, `STORAGE_LOCAL_ROOT` | Swap external integrations for local stubs |
| `STORAGE_S3_ENDPOINT`, `_PUBLIC_ENDPOINT`, `_REGION`, `_ACCESS_KEY`, `_SECRET_KEY`, `STORAGE_BUCKET`, `STORAGE_REQUIRE_ENCRYPTION`, `STORAGE_CREATE_BUCKETS` | Object storage on MinIO when `STORAGE_ADAPTER_MODE=live`; `server/api/.env.example` explains each |
| `LOG_LEVEL`, `OTP_DEBUG_LOG`            | Logging                                          |
| `INJISHI_PROCESS`                       | `worker` runs the queue process instead of HTTP  |
| `MIGRATIONS_DIR`                        | Overrides where the migrator looks for SQL       |
| `OPERATOR_APP_URL`                      | Where web forwards the operator zone (default `http://localhost:3002`) |
| `OPERATOR_ASSET_PREFIX`                 | The zone's `assetPrefix` (default `/operator-static`) |

The API **fails at boot** rather than starting half-configured when a required
value is missing or malformed. Two boot refusals are security controls, not
convenience checks:

- `OVERSIGHT_AUTH_SECRET` must not equal `BETTER_AUTH_SECRET`. Two trust
  boundaries mean two signing keys.
- The fixed demo OTP code is a constructor argument to the demo auth instance,
  never a runtime flag, so a fixed code cannot be reached in production.

---

## Authorization

Read this before touching a route, because each piece covers less than its name
suggests.

**Authentication** is Better Auth (email OTP plus Google), configured once in
`@injishi/auth`. OTP codes are stored **hashed** — Better Auth stores them in
plaintext by default, which turns any read of the `verifications` table into
account takeover.

**The boundary is on the API**, and it is two guards composed in this order:

```ts
@UseGuards(SessionGuard, WorkspaceGuard)
```

- `SessionGuard` (`src/shared/auth/session.guard.ts`) resolves the session from
  request cookies and attaches the user. Pair it with `@CurrentUser()`, which
  throws when a route forgot the guard.
- `WorkspaceGuard` (`src/shared/auth/workspace.guard.ts`) refuses a request that
  names a workspace the caller does not hold, or that lacks the permission the
  route declares via `@RequirePermission(...)`. It throws a 500 rather than
  treating the request as anonymous when `SessionGuard` did not run first.

The permission model itself lives in `@injishi/contracts` (`authz.ts`) — one
definition that both sides import, so client and server cannot drift.

**The registration gate** lives in the model, not in a guard.
`permissionsForWorkspace` returns an **empty set** unless the org is `active`,
so the owner of a business still in the registration pipeline holds the role and
none of its powers. The workspace is still listed at every stage on purpose: the
registrant opens it to watch the pipeline.

**The web app's middleware is a routing control, not the boundary.**
`src/middleware.ts` verifies the session cookie against the API (a cookie
outlives the session it names, so presence alone is not enough) and bounces to
`/sign-in`. `PROTECTED_PREFIXES` is an **allowlist** — `/trips`, `/saved`,
`/lease`, `/inbox`, `/account`, `/claim-org` — because the marketplace is meant
to be read by strangers. `/register`, `/verify-otp` and `/activate` are ungated
on purpose: they are steps of signing in, and gating them locks the door from
the inside. Broker screens are deliberately absent: they are a supply-side job
and live in the operator app, behind its own gate.

**Client-side capability is an affordance, never the boundary.**
`src/data/me.ts` is the client for `/api/v1/me/*`; what it returns shapes the UI
and words a refusal. Resolving a permission *from a role* in the browser is
forbidden, and the `injishi/no-client-authz` ESLint rule fails the build on an
import or re-export of `can` / `permissionsForRole` in `apps/web` and
`apps/app`.

**The operator app holds no model of its own.** `apps/app/src/pms/authz.ts`
re-exports the permission table from `@injishi/contracts`, so the app words a
refusal from the same table the API refuses from and the two cannot drift.
`authorize()` in `src/pms/store/helpers.ts` is the one choke point for guarded
mutations, and `app-shell.tsx` builds the allowed screen set from `navFor`
(`src/pms/lib/nav.ts`) — one mechanism for screen access, not two. All of it
runs in the browser: it is product correctness, not a security boundary.

---

## Commands

Run everything from the repository root.

```bash
pnpm install              # install
pnpm dev:all              # everything: Docker services, migrations, then api,
                          # worker, web, app and mobile in one terminal
pnpm dev                  # web on :3000 and the operator app on :3002
pnpm app:dev              # operator app on :3002
pnpm api:dev              # api on :8000, watch mode
pnpm api:worker           # queue worker (needs the api built)
pnpm build                # build web + app + api (not mobile)
pnpm typecheck            # tsc --noEmit across the workspace
pnpm lint                 # eslint across the workspace
```

Database, from `server/api`:

```bash
pnpm --filter @injishi/api drizzle:generate   # write a migration from the schema
pnpm --filter @injishi/api db:migrate         # apply pending migrations
pnpm --filter @injishi/api seed:geography     # Rwanda administrative geography
pnpm --filter @injishi/api seed:content       # static content
pnpm --filter @injishi/api db:seed            # the sample recipe (seed-sample.mjs); refuses an unmarked database
pnpm --filter @injishi/api seed:hr-demo       # a working HR demo, through the running API; sample databases only
```

`seed:hr-demo` is the one seed that needs the API up (`pnpm api:dev`): it signs
in as the demo owners and fills Staff the way an office would, so contracts,
rosters, attendance, leave and a confirmed pay run are rows the product wrote.
Without it every Staff lens but Employees opens empty. Safe to run again.

`db:migrate` is built on `drizzle-orm`'s migrator, **not** on `drizzle-kit`.
drizzle-kit is a devDependency and is not in the runtime image, so a release
step that shells out to it works on a laptop and fails on the platform. The
script is idempotent — running it on every deploy is the intended use.

Web asset generation, from `apps/web`:

```bash
pnpm --filter @injishi/web regen   # app CSS, AVIF twins, image sizes, PWA icons
```

Tests:

```bash
pnpm --filter @injishi/api test    # jest, *.spec.ts under src/
pnpm --filter @injishi/web test    # node:test, tests/*.test.mjs
pnpm --filter @injishi/api madge   # fail on circular imports
```

---

## Conventions

These are enforced, not suggested. The plugin lives in `tools/eslint-rules/`.

- **Every file name is kebab-case.** Only the file name — the exported symbol
  stays PascalCase, so `app-shell.tsx` exports `AppShell`. Enforced by
  `injishi/kebab-case-filenames`.
- **No hardcoded hex values and no raw Tailwind colour classes.** Colour comes
  from `@injishi/design-tokens` as CSS variables. There is no exception.
- **Never resolve a permission from a role in browser code.** Enforced by
  `injishi/no-client-authz`.
- **A guarded route must declare its permission.** Enforced on the service by
  `injishi/require-permission-on-guarded-route`.
- **Schema first in contracts.** Zod schema, then the type inferred from it —
  never a type declared alongside a schema.
- **`packages/*` IS the source.** Edit it directly; for `@injishi/design-tokens`,
  rebuild and regenerate, and `pnpm -F @injishi/design-tokens check` proves it.

---

## Deployment

Three stacks run on one VPS: production, staging and demo. Every deploy fact —
hosts, process order, cookie and CORS values, DNS, the cutover — lives in
[`infra/docker/DOKPLOY.md`](infra/docker/DOKPLOY.md), and the container images
are in [`infra/docker/`](infra/docker/).

The pipeline is in [`.github/workflows/`](.github/workflows/):

- **Every pull request** runs `ci`: typecheck, lint with a warning ratchet, unit
  tests and a build for each workspace member the change touches, plus
  `integration` against a real Postgres and Redis when it touches the API. One
  aggregating status, `ci-complete`, is what branch protection requires.
- **Every green commit on `main`** builds one API image, pushed to GHCR tagged
  with its short sha, and deploys itself to staging. The three frontends are
  built on the host, because they bake per stack values and cannot be promoted.
- **Production is a button**: a `workflow_dispatch` naming a commit, refused
  unless staging is already running that commit and a recent backup succeeded,
  and rolled back automatically if the new release does not become healthy.

Railway and Vercel are retired as deployment paths. Public DNS still points at
them until the cutover; `server/api/RAILWAY.md` keeps the historical record.

---

## License

No license is declared in this repository. Treat it as proprietary and
all rights reserved unless the owner says otherwise.

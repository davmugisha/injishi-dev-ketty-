# Injishi

Hospitality and property platform for Rwanda: a public marketplace where guests
find and book a stay, the operator app hotels, landlords, officers and Injishi
staff work in, and the API behind both.

| Path          | Package           | What it is |
| ------------- | ----------------- | ---------- |
| `apps/web`    | `@injishi/web`    | Next.js 16 marketplace and the signed-in guest pages (`/trips`, `/account`, ...) |
| `apps/app`    | `@injishi/app`    | Next.js 16 operator app (HeroUI v3 and Pro): sign-in, every persona's screens, the admin console at `/admin` |
| `apps/mobile` | `@injishi/mobile` | Expo app (no build in CI; see `.github/workflows/mobile-release.yml`) |
| `server/api`  | `@injishi/api`    | NestJS 11 modular monolith on Fastify, plus its BullMQ worker |
| `packages/*`  | `@injishi/*`      | Shared packages: auth, contracts, data, db, design-tokens, qr, ui, ui-contract, utils, web-ui |

## Web and the app are two origins

The app has its own origin in every stack: `app.injishi.com` in production,
<http://localhost:3002> locally. Web (`www.injishi.com`, <http://localhost:3000>)
hands `/sign-in` to it, and the app sends each person to their own home
(`apps/app/src/lib/return-to.ts`); a guest goes back to web's `/trips`. Web's
`/start` sends anyone holding a business, broker, oversight or staff role to
the app's `/auth/continue`, which does the same. Web serves none of the app's
pages. The session cookie is shared: the API sets it on the parent domain when
deployed, and on `localhost`, which every port shares, on a laptop.

## Requirements

- **Node** `>=22.13` (`mise.toml` pins the version CI uses) and **pnpm** `12.3.4`
  (`packageManager` in `package.json`)
- **Docker**: Colima or Docker Desktop (`infra/docker/README.md`)
- **`HEROUI_AUTH_TOKEN`** in a root `.env` (copy `.env.example`): the HeroUI Pro
  package downloads its code with it at install time

## Quick start

```bash
pnpm install          # from the repository root, with the root .env in place
pnpm docker:up        # Postgres, Redis, Mailpit, then the API, worker, web and app
```

Open <http://localhost:3000> (marketplace) or <http://localhost:3002/sign-in>.
The local database is a TESTING database: reference data (geography, classes,
amenities, tax rates) and test settings, no demo people or businesses. Sign in
as `admin@injishi.test` (the first Injishi admin) or any new email to create an
account; codes are real and land in Mailpit at <http://localhost:8025>. Set
`STACK_SEED=sample` and `INJISHI_ENVIRONMENT=demo` in `server/api/.env.test`
for the old demo world (fixed code `123456`). For hot
reload, run the apps on your machine with `pnpm dev:all` instead.
`infra/docker/README.md` has the details.

Environment files (one per environment, per package) are explained at the top
of `.env.example`; every API variable is in `server/api/.env.example`.

## Repository layout

```text
apps/web/            marketplace: src/app/(marketplace) public pages, src/app/(app) sign-in
                     steps, registration and the guest's own pages; src/proxy.ts gates
                     the private ones; src/lib/access.ts and app-handoff.ts send people to the app
apps/app/            operator app: src/app route groups ((workspace), (phone), (device),
                     (public), (auth)), src/features per domain, src/server (API client,
                     reads and server actions), src/proxy.ts route guard
apps/mobile/         Expo Router app
server/api/          src/main.ts (one entry; INJISHI_PROCESS=worker runs the queues),
                     src/api (controllers), src/modules (domains), src/database/drizzle
                     (schema and SQL migrations), src/shared (guards, config, queues)
packages/            shared packages, source (see below)
tools/eslint-rules/  the ESLint plugin web and the API lint with
infra/docker/        Dockerfiles, compose files (local, staging, demo, production), DOKPLOY.md
scripts/             CI checks, the local stack scripts, content and image generators
```

### packages

`packages/*` is source; edit it directly. Four are compiled and consumers read
their committed `dist/`: `@injishi/auth`, `@injishi/contracts`,
`@injishi/design-tokens` and `@injishi/qr`. Rebuild after editing
(`pnpm --filter <name> build`), commit `dist/` with `src/`, and revert a rebuild
that changes only line endings. `pnpm --filter @injishi/design-tokens check`
fails when its `dist/` or `generated/` drifts from `src/`. The rest ship
TypeScript the Next apps compile through `transpilePackages`. `@injishi/ui` is
the app's kit; web imports `@injishi/web-ui` under the name `@injishi/ui`.

## Authorization

The boundary is the API (`server/api/src/shared/auth/README.md`):
`@UseGuards(SessionGuard, WorkspaceGuard)` with `@RequirePermission(...)` on
workspace routes, `StaffGuard` for staff, `OversightGuard` for officers. The
permission model lives once in `@injishi/contracts` (`src/authz.ts`). A business
still in registration holds its role and none of its powers: the permission set
is empty until the org is `active`.

Web's and the app's `proxy.ts` only route: web verifies the session cookie on
its private prefixes (`/trips`, `/account`, `/start`, ...) and bounces to
sign-in; the app sends a visitor without a session to `/sign-in`, and each page
checks the persona with `requireScreen`. Neither is a security boundary. The
`injishi/no-client-authz` ESLint rule stops web resolving a permission from a
role in the browser.

## Commands

Run from the repository root.

```bash
pnpm docker:up            # the whole stack in Docker (docker:rebuild, :logs, :ps, :down)
pnpm dev:all              # the stack's services, then every app as a dev server
pnpm web:dev              # web on :3000 (webpack, for its service worker)
pnpm app:dev              # the app on :3002
pnpm api:dev:test         # the API on the local stack (.env.test), :8000
pnpm build                # build every package and app except mobile
pnpm typecheck            # tsc across the workspace
pnpm lint                 # Biome (app, mobile, data, db, ui) and every member's lint
pnpm test                 # every suite
```

Database: `pnpm --filter @injishi/api db:migrate` applies pending migrations
(drizzle-orm's migrator, so it works in the runtime image), `drizzle:generate`
writes one from the schema, and `db:seed` runs the sample recipe on a database
marked as sample.

Tests: `pnpm --filter @injishi/api test` (Jest), `@injishi/web test` and
`@injishi/contracts test` (node:test), `@injishi/app test` (tsx). CI is
`.github/workflows/ci.yml`; `pnpm check:manifests`, `pnpm lint:ratchet` and
`node scripts/api-cycles-ratchet.mjs` are its checks you can run locally.

## Conventions

- Colour comes from tokens, never hex values or raw Tailwind colour classes.
- Never resolve a permission from a role in browser code.
- A guarded API route declares its permission
  (`injishi/require-permission-on-guarded-route`).
- Contracts are schema first: the zod schema, then the type inferred from it.
- Web and the API lint with ESLint (`tools/eslint-rules`, kebab-case file
  names in web); the app, mobile and their packages with Biome (`biome.json`).

## Deployment

Production, staging and the demo run on one VPS; hosts, process order, cookie
and CORS values and DNS are in [`infra/docker/DOKPLOY.md`](infra/docker/DOKPLOY.md).
Every pull request runs `ci` (one required status, `ci-complete`). Every green
commit on `main` builds the API image and deploys staging; the frontends are
built on the host because they bake per stack values. Production is a manual
`workflow_dispatch` that needs staging on the same commit and a recent backup.

## License

No license is declared. Treat it as proprietary, all rights reserved.

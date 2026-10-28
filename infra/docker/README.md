# Local stack

Everything runs in Docker with one command, from `injishi/`. Running the apps
as dev servers on your machine (hot reload) is section 3.

## 1. Everything in Docker (the usual way)

```bash
pnpm docker:up                  # db, redis, mailpit (migrated, seeded once), then api, worker, web, app
pnpm docker:up --build          # rebuild every image first
pnpm docker:rebuild web app     # after a code change: rebuild and restart (api, worker, web, app)
pnpm docker:logs api            # follow a log (all four apps when none is named)
pnpm docker:ps                  # what is running
pnpm docker:down                # stop everything, keep the data
pnpm docker:down --apps         # stop the apps, keep db, redis, mailpit
```

| What     | Where |
|----------|-------|
| web      | <http://localhost:3000>: marketplace and registration; `/sign-in` hands off to the app |
| app      | <http://localhost:3002>: sign-in, the operator screens (`/residence`, `/owner`, ...), `/admin` |
| API      | <http://localhost:8000> (health: `/api/v1/health`) |
| Mailpit  | <http://localhost:8025>: every mail, sign-in codes included |
| Postgres | `127.0.0.1:5434`, user and password `injishi` |
| Redis    | `127.0.0.1:6381` |

Sign in at <http://localhost:3000/sign-in> or <http://localhost:3002/sign-in>
as `admin@injishi.test` (the first Injishi admin) or any new email, which
creates the account. Codes are real: read them in Mailpit. Each person lands
on their own home in the app (a guest on web's `/trips`). This is the same
model as production, where the app is `app.injishi.com`.

- **Production builds, not dev servers.** Nothing recompiles on save: rebuild
  the service you changed. Builds run one at a time (a `next build` peaks at
  about 3.3 GB). On a VM under 6 GB (Colima's default is 4) the script stops the
  apps while it builds; `colima stop && colima start --memory 6` keeps them up.
  If Docker stops answering mid-build, `colima restart` and run the same
  command again; it resumes from the cached install.
- **The API runs as production on the testing database** (real codes in
  Mailpit, no personas, mock payments; reference data and settings only) on
  `server/api/.env.test`, then `server/api/.env.test.local` if you have one,
  with `db`, `redis` and `mailpit` as hosts. Uploads go to `server/api/.storage`,
  the folder `pnpm api:dev:test` uses too.
- **One network namespace.** The frontends are built with `localhost` URLs and
  their servers call them too, so api, web and app share the namespace of a
  small `net` container that publishes 3000, 3002 and 8000.
- **Needs** `HEROUI_AUTH_TOKEN` in the root `.env` (see `.env.example`), passed
  to the web and app builds as a BuildKit secret and never printed, and the
  buildx plugin (`brew install docker-buildx` with Colima). Stop host dev
  servers on 3000, 3002 and 8000 first.

## 2. Install Docker (once)

- **macOS:** `brew install colima docker docker-compose docker-buildx`, then
  `colima start` (add `--memory 6` if the machine has room).
- **Windows 11:** Docker Desktop on WSL 2 (`wsl --install --no-distribution`,
  reboot, `winget install -e --id Docker.DockerDesktop`). An account without
  admin rights must be added to `docker-users`
  (`net localgroup docker-users "<whoami>" /add`, as Administrator), then sign
  out and in again. Check with `docker version` and `docker compose version`.

## 3. Only the services in Docker, the apps on your machine

```bash
pnpm dev:stack                  # start db, redis, mailpit, migrate, seed. Safe to re-run
pnpm dev:stack:down             # stop them, keep the data
pnpm dev:stack:reset            # delete the data, then start, migrate and seed again
pnpm dev:all                    # the stack (seeding only a new database), then every app
                                # in this terminal: api, worker, web, app, mobile
pnpm dev:all --skip mobile      # everything except mobile
pnpm dev:all --only web,api     # just these
```

Or one at a time: `pnpm api:dev:test` (API on this stack, :8000),
`pnpm api:worker:dev:test` (queued mail waits until it runs), `pnpm web:dev`
(:3000), `pnpm app:dev` (:3002), `pnpm dev:mobile` (Expo). `pnpm api:dev` is
the hosted dev services (`.env.development`); never seed or migrate those from
here.

`dev:all` labels every line with its app, starts the Docker engine when it is
down, stops if a port is taken (naming the process), and prints a QR code for
Expo Go: Metro and the API url get this machine's Wi-Fi address so a phone on
the same network can open the app (`--lan <address>` picks another).

## 4. What `pnpm dev:stack` does

1. Reads `server/api/.env.test` (`DATABASE_URL`, `REDIS_PORT`) and starts
   Postgres and Redis on those ports (5434 and 6381), and Mailpit. MinIO starts
   only when that file stores through S3; it says `STORAGE_ADAPTER_MODE=local`
   (files on disk), so it does not.
2. Refuses a `DATABASE_URL` or Redis on another machine: it never migrates or
   seeds a hosted database.
3. Runs `server/api/scripts/migrate.mjs`, marks the database as sample data
   (`mark-sample-database.mjs --sample`, ADR-043; Postgres refuses the mark once
   a user exists, so an older database needs `pnpm dev:stack:reset`), then the
   one sample recipe, `seed-sample.mjs`, the same one staging and the demo run:

| Script | What it writes |
|---|---|
| `seed-geography.mjs` | provinces to villages |
| `seed-content.mjs` | reference data, the seeded hotel |
| `seed-users.mjs` | the `@injishi.com` accounts, their workspaces and grants, the residence org |
| `seed-content.mjs` (again) | the residence building, units and leases (they need that org) |
| `seed-demo.mjs` | the demo roster (`*@demo.injishi.com`) and its rows |
| `seed-demo-catalogue.mjs` | the catalogue properties web links to, marked as demo data |

Every seed refuses a database without the sample marker.

## A second stack, in a git worktree

A worktree of `injishi` (the mobile one is `Injishi-workspace/injishi-mobile`,
mobile spec 0001) can run its own stack while the main checkout's runs. Its
`server/api/.env` is a copy of the main one with every port moved, plus the
settings in the "second local stack" section of `server/api/.env.example`:

| Setting | Main checkout (default) | Mobile worktree |
|---|---|---|
| `INJISHI_COMPOSE_PROJECT` | unset (`docker`) | `injishi-mobile` |
| `DATABASE_URL` port, `REDIS_PORT` | 5432, 6379 | 5532, 6479 |
| `INJISHI_MINIO_PORT`, `INJISHI_MINIO_CONSOLE_PORT` (and the `STORAGE_S3_*` endpoints) | 9000, 9001 | 9100, 9101 |
| `SMTP_URL` port, `INJISHI_MAILPIT_PORT` | 1025, 8025 | 1125, 8125 |
| `PORT` (and `BETTER_AUTH_URL`), `INJISHI_METRO_PORT` | 8000, 8081 | 8100, 8181 |
| `INJISHI_ENVIRONMENT`, `INJISHI_SAMPLE_DATA` | unset, unset (`on`) | `production`, `off` |

The project name gives it its own containers and volumes. A worktree that sets
no project is refused, because compose would otherwise run it as the main
checkout's `docker` project, recreate those containers on its ports and share
their data. With `INJISHI_SAMPLE_DATA=off` the stack only migrates: the
database is never marked sample or seeded, and the API runs as production, so
codes are random and land in that stack's Mailpit. In a second stack,
`pnpm dev:all` starts the API, the worker and Metro only; web and app run from
the main checkout, because their ports are fixed.

## Why the API is not in this compose file

The file used to have `api` and `web` services. They built the production
images and could not work for local development:

- The image sets `NODE_ENV=production`. Under production nobody can sign in
  locally: `OTP_DEBUG_LOG` is forced off and the process runs as production,
  with no fixed code.
  `SmsModule` also refuses to boot on its mock adapter.
- Setting `NODE_ENV=development` instead crashes the logger. `pino-pretty` is
  a devDependency, and the image leaves devDependencies out.
- The `api` service published port 4000, but the API listens on `PORT` (8000).
- It passed `SESSION_SECRET`, which the API never reads. The API reads
  `BETTER_AUTH_SECRET` and `COOKIE_SECRET`.
- It had no Redis.

So local development runs the API on your machine, with hot reload, against
`db` and `redis` here. The stack built from the images is
`docker-compose.staging.yml`.

## Troubleshooting

- **`password authentication failed` during migrate.** The data volume was made
  with other credentials; Postgres keeps its first user. `pnpm dev:stack:reset`.
- **Port already in use.** Stop the other program: the stack's ports come from
  `server/api/.env.test`, and the apps' are 3000, 3002 and 8000.
- **`DATABASE_URL` set in your shell.** It beats the env file; unset it in the
  terminal where you start the API.

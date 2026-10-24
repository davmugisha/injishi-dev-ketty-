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

## Troubleshooting

- **`password authentication failed` during migrate.** The data volume was made
  with other credentials; Postgres keeps its first user. `pnpm dev:stack:reset`.
- **Port already in use.** Stop the other program: the stack's ports come from
  `server/api/.env.test`, and the apps' are 3000, 3002 and 8000.
- **`DATABASE_URL` set in your shell.** It beats the env file; unset it in the
  terminal where you start the API.

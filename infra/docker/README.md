# Local dev stack

Postgres, Redis, MinIO and Mailpit run in Docker. The API and the apps run on
your machine. Once Docker Desktop is installed, this is the only command you
need, run from `injishi/`:

```bash
pnpm dev:all            # the stack, then every app in this terminal (section 3)
```

The stack on its own:

```bash
pnpm dev:stack          # start the services, migrate, seed. Safe to re-run
pnpm dev:stack:down     # stop the containers and keep the data
pnpm dev:stack:reset    # delete the data, then start, migrate and seed again
```

`scripts/dev-stack.mjs` reads `server/api/.env` and starts Postgres and Redis
on the ports it names (the template's are **5432** and **6379**), so `pnpm
api:dev` connects without any extra setup. It refuses to run if `DATABASE_URL`
or Redis points at another machine, because it will not migrate or seed a
hosted database.

## 1. Install Docker Desktop (Windows 11, one time, needs an administrator)

Your account has no admin rights, so an administrator does steps 1 to 4. Run
each command in **PowerShell opened as Administrator**.

**1. Repair WSL.** On this machine `wsl` fails with `REGDB_E_CLASSNOTREG`
("class not registered"). That usually means the WSL package or its Windows
features are missing or broken.

```powershell
wsl --install --no-distribution
```

Reboot. If `wsl` still fails with the same error, turn the two Windows features
on directly, reboot, and then install the WSL package:

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
Restart-Computer
```

After the reboot:

```powershell
wsl --update --web-download
```

If `wsl.exe` cannot run at all, install the latest `wsl.<version>.x64.msi` from
<https://github.com/microsoft/WSL/releases> instead. You can move on when
`wsl --version` prints version numbers. If WSL still will not work, open Task
Manager, go to Performance, then CPU, and check that it says
**Virtualization: Enabled**. If it does not, turn virtualization on in the
BIOS/UEFI settings.

**2. Install Docker Desktop.**

```powershell
winget install -e --id Docker.DockerDesktop
```

You can also download the installer from
<https://www.docker.com/products/docker-desktop/>. Leave **"Use WSL 2 instead
of Hyper-V"** checked. *If WSL cannot be repaired:* Windows 11 Pro can use the
Hyper-V backend instead. Run
`Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All`,
reboot, and uncheck that box when you install.

**3. Let your own account use Docker.** Docker Desktop only lets members of
`docker-users` use the engine, and the installer adds only the account that ran
it. First run `whoami` in **your own** terminal. Then, as Administrator:

```powershell
net localgroup docker-users "<output of whoami>" /add
```

**4. Sign out of Windows and back in**, or reboot, so the group change takes
effect.

**5. Start Docker Desktop** from the Start menu as yourself. Accept the terms
and wait until it shows **Engine running**. Then check it in a new terminal:

```powershell
docker version
docker compose version
```

**6. Bring the stack up:**

```powershell
cd injishi
pnpm install
pnpm dev:stack
```

> Docker Desktop is free for personal use, education, and businesses with
> fewer than 250 employees and less than $10M in annual revenue. Larger
> organisations need a paid subscription.

## 2. What `pnpm dev:stack` does

1. Parses `DATABASE_URL` (host, port, user, password, database) and `REDIS_PORT`
   (or `REDIS_URL`) from the API's `.env`.
2. Checks that Docker is installed and its engine is running. If not, it prints
   the steps above and exits non-zero.
3. Runs `docker compose -f infra/docker/docker-compose.yml up -d db redis
   mailpit minio` with those ports and credentials. It stops first if another
   program already holds one of those ports, such as a Postgres installed on
   Windows.
4. Waits, for a limited time, until both containers report healthy and the
   ports answer from your machine.
5. Runs the API's own `scripts/migrate.mjs`, which applies every migration
   that exists.
6. Marks the database as sample data with `scripts/mark-sample-database.mjs
   --sample` (ADR-043). Postgres accepts the mark only while the database holds
   no user, so a database made before this step existed stops the script here,
   with the two ways out: `pnpm dev:stack:reset` rebuilds it as a sample
   database (its data is deleted), or keep it and run the API with
   `INJISHI_ENVIRONMENT=production`.
7. Runs the one sample recipe, `scripts/seed-sample.mjs`, the same one staging
   and the demo run. In order:

| Script | What it writes |
|---|---|
| `seed-geography.mjs` | provinces → villages (other tables point at it) |
| `seed-content.mjs` | reference data, the seeded hotel |
| `seed-users.mjs` | the `@injishi.com` sign-in accounts, their workspaces and grants, the residence org |
| `seed-content.mjs` (second pass) | the residence building, units and leases, which need the org `seed-users` creates. Every insert is `ON CONFLICT DO NOTHING`, so the second pass only adds what the first skipped |
| `seed-demo.mjs` | the demo roster (`*@demo.injishi.com`, the staff persona included) and the rows it trades on |
| `seed-demo-catalogue.mjs` | the 52 catalogue properties the web app links to, each one marked as demo data |

Every seed refuses, as its first act, a database without the sample marker.
That replaces the old `DEV_DATABASE_URL` / `DEMO_DATABASE_URL` comparison: the
database says what it is, rather than a URL being a different string.

## 3. Then start the apps

All of them, in one terminal, from `injishi/`:

```bash
pnpm dev:all                       # api, worker, web, admin, app, mobile
pnpm dev:all --skip mobile         # everything except mobile
pnpm dev:all --only web,api        # just these
```

It runs the steps of section 2 first, with two differences: it starts Docker
Desktop itself when the engine is not running, and it seeds only a database
the recipe never finished on (`database_identity.seeded_at` is empty), so a
daily start keeps your data. `pnpm dev:stack` still reseeds every time. Before
that, it runs `pnpm install --frozen-lockfile` when `pnpm-lock.yaml` changed
since the last install, and it stops if one of the apps' ports is already
taken, naming the process holding it.

Every line is labelled with the app that printed it. Once they answer it prints
where each one is, and a QR code for Expo Go: mobile starts with `start:go`,
and Metro and the API url are given this PC's Wi-Fi address, so a phone on the
same network can open it (`--lan <address>` picks another). Ctrl+C stops every
app. The Docker services keep running; `pnpm dev:stack:down` stops them.

Or each one in its own terminal:

```bash
pnpm api:dev                       # API       http://localhost:8000
pnpm api:worker:dev                # queue worker: queued mail waits until it runs
pnpm web:dev                       # web       http://localhost:3000
pnpm app:dev                       # operator  http://localhost:3002
pnpm --filter @injishi/admin dev   # admin     http://localhost:3001
pnpm --filter @injishi/mobile start:go   # Expo Go; set EXPO_PUBLIC_API_URL to a LAN address for a phone
```

Sign in at <http://localhost:3000/sign-in> with `host@injishi.com` (the owner of
the seeded hotel), `admin@injishi.com` (admin console), `guest@injishi.com`, or
pick a demo persona from the list the sign in screen shows. With
`INJISHI_ENVIRONMENT` unset the API runs as the demo, so every code is
`123456`, and every mail also lands in Mailpit at <http://localhost:8025>.

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

- **`password authentication failed` during migrate.** The data volume was
  created with different credentials from the ones `DATABASE_URL` names now.
  Postgres keeps its first user. Run `pnpm dev:stack:reset`.
- **Port already in use.** Stop the other program, or change the port in
  `DATABASE_URL` or `REDIS_PORT` in the API's `.env`. The stack follows the
  `.env`.
- **`DATABASE_URL` is also set in your shell.** `pnpm api:dev` uses the shell's
  value before the `.env` one, and the script warns about it. Unset it in the
  terminal where you start the API.

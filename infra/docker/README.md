# Local dev stack

Postgres and Redis run in Docker. The API and the apps run on your machine.
Once Docker Desktop is running, this is the only command you need, run from
`injishi/`:

```bash
pnpm dev:stack          # start Postgres + Redis, migrate, seed. Safe to re-run
pnpm dev:stack:down     # stop the containers and keep the data
pnpm dev:stack:reset    # delete the data, then start, migrate and seed again
```

`scripts/dev-stack.mjs` reads `server/api/.env` (or `server/api/.env` after
the rename) and starts Postgres and Redis on the ports it names: today that is
**5434** and **6381**. So `pnpm api:dev` connects without any extra setup. It
refuses to run if `DATABASE_URL` or Redis points at another machine, because it
will not migrate or seed a hosted database.

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
3. Runs `docker compose -f infra/docker/docker-compose.yml up -d db redis` with
   those ports and credentials. It stops first if another program already
   holds one of those ports, such as a Postgres installed on Windows.
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
| `seed-users.mjs` | the `@injishi.rw` sign-in accounts, their workspaces and grants, the residence org |
| `seed-content.mjs` (second pass) | the residence building, units and leases, which need the org `seed-users` creates. Every insert is `ON CONFLICT DO NOTHING`, so the second pass only adds what the first skipped |
| `seed-demo.mjs` | the demo roster (`*@demo.injishi.rw`, the staff persona included) and the rows it trades on |
| `seed-demo-catalogue.mjs` | the 52 catalogue properties the web app links to, each one marked as demo data |

Every seed refuses, as its first act, a database without the sample marker.
That replaces the old `DEV_DATABASE_URL` / `DEMO_DATABASE_URL` comparison: the
database says what it is, rather than a URL being a different string.

## 3. Then start the apps

Run each one in its own terminal, from `injishi/`:

```bash
pnpm api:dev                       # API       http://localhost:8000
pnpm web:dev                       # web       http://localhost:3000
pnpm app:dev                       # operator  http://localhost:3002
pnpm --filter @injishi/admin dev   # admin     http://localhost:3001
```

Sign in at <http://localhost:3000/sign-in> with `host@injishi.rw` (the owner of
the seeded hotel), `admin@injishi.rw` (admin console), `guest@injishi.rw`, or
pick a demo persona from the list the sign in screen shows. With
`INJISHI_ENVIRONMENT` unset the API runs as the demo, so every code is
`123456`, and every mail also lands in Mailpit at <http://localhost:8025>.

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

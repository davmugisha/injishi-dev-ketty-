# Database durability, backups and restores (local and demo)

This covers the **local/demo** PostgreSQL. Production and staging have their own runbook in [`DOKPLOY.md`](DOKPLOY.md).

## What runs where

| Piece | Where | Durable? |
|---|---|---|
| **Docker Postgres 17** (`injishi-pos-db`) | `127.0.0.1:5433`, database `injishi_demo`, data in the named volume `injishi-pos-db_db-data` | Yes: survives container restart, recreation and `down`; restarts with Docker (`restart: unless-stopped`) |
| Live demo database (today) | a portable Postgres on `127.0.0.1:5434`, started by hand, files in a temp folder | **No**: not restarted by a reboot, lost if its folder is cleaned. Backed up by the schedule below until the demo is cut over |
| Redis | Docker `injishi-pos-redis`, `127.0.0.1:6391`, `appendonly yes`, named volume | Yes, restarts with Docker |

Port **5432** belongs to the Windows PostgreSQL service on the development machine, so the Docker database uses **5433**.
Both are bound to `127.0.0.1` only. Change the port with `INJISHI_DB_PORT` at cutover if you want 5432 free of the service.

## Starting the Docker database

```powershell
# secrets live OUTSIDE the repo, in a file only your Windows account can read
$env:INJISHI_DB_USER='injishi'; $env:INJISHI_DB_NAME='injishi_demo'; $env:INJISHI_DB_PORT='5433'
$env:INJISHI_DB_PASSWORD = '<from your secrets file>'
docker compose -p injishi-pos-db `
  -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.db-persistent.yml up -d db
```

Never use the compose default password (`injishi`) for anything you care about, and never run `down -v` on this project:
`-v` deletes the volume, and with it the database.

## Scheduled backups

`infra/backup/backup.mjs` runs from a Windows scheduled task (`Injishi POS database backup`, **every 3 hours and at every sign-in**,
install with `infra/backup/install-backup-task.ps1`). For each target in its config it:

1. dumps (`pg_dump -Fc`) to a `.partial` file, then verifies it (`pg_restore --list`, size, tables with data),
2. writes `<name>.dump.sha256` and makes both files read-only,
3. **restores the dump into a scratch database** (`injishi_backup_verify`, on the Docker server) and compares the row
   count of every table with the dump's own contents, then drops the scratch database,
4. applies retention, only to its own files (`<target>_<yyyymmdd>-<hhmmss>.dump`).

Retention: everything from the last **3 days**; then the newest of each day for **14 days**; then the newest of each week
for **8 weeks**; never fewer than the newest **6**. Backups you make by hand (any other file name) are never touched.

Where: `…/injishi-db-backups/scheduled/<target>/`, logs in `…/scheduled/logs/`, and `…/scheduled/status.json` with the
last result per target. Exit codes: `0` all good, `1` a backup or its restore drill **failed**, `2` the backup is good but
the drill server was down. Check `status.json` (or the task's *Last Run Result*) from time to time.

Credentials are read from the files named in the config at run time and are scrubbed from the log.

## Restoring

Always restore into a **new** database, check it, and only then switch the application to it. Never restore over a
database in use.

```powershell
# 1. pick the newest good backup and check it
cd "…\injishi-db-backups\scheduled\docker-demo"
sha256sum -c docker-demo_<stamp>.dump.sha256         # must say OK

# 2. create an empty database with the same collation, restore, check
$env:PGPASSWORD = '<password>'
psql -h 127.0.0.1 -p 5433 -U injishi -d postgres -c "CREATE DATABASE injishi_restored TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'"
pg_restore -h 127.0.0.1 -p 5433 -U injishi -d injishi_restored --exit-on-error --no-owner docker-demo_<stamp>.dump
psql -h 127.0.0.1 -p 5433 -U injishi -d injishi_restored -c "select count(*) from drizzle.__drizzle_migrations"

# 3. only when satisfied, point the API's DATABASE_URL at injishi_restored (a deliberate, approved cutover)
```

If the Docker volume itself is lost, create the container again (above), create the database, and restore the newest
backup the same way. The data is exactly as old as that backup, which is why the schedule runs every 3 hours.

## Health checks

- `GET /api/v1/health` is **liveness**: the process is up. It has no dependencies on purpose.
- `GET /api/v1/health/ready` is **readiness**: the database answers a query and Redis answers a PING on the connection the
  queues use. `200` when both do; `503` when either does not, naming which and giving only `timeout` or `unreachable`
  (never an error message, so it cannot leak a connection string). Point load balancers and uptime monitors at this one.

## Limits to know about

- **A laptop that is asleep cannot back up.** A run that lands on a sleep or a wake is lost, silently (the process is killed
  with `0xC000013A`; this happened twice on the demo machine). The task therefore runs every 3 hours, at every sign-in, may wake
  the machine and runs a missed slot when it returns. Do not rely on "the last run succeeded": ask how old the newest good
  backup is: `node backup.mjs --config <file> --check-fresh 6` prints `STALE ...` and exits 1 when any target has none newer
  than 6 hours. Check it before a demo, and copy the backup folder to another disk or cloud folder.
- A backup is only as fresh as its last run; a 3-hourly schedule can lose up to 3 hours of data (more if the machine slept). Continuous archiving
  (WAL) is not set up.
- Docker Desktop must start at login for the container's restart policy to bring the database back after a reboot.
- The backups live on the same disk as the data. Copy `…/scheduled` to another disk or cloud folder regularly.
- The 5434 server's password is the committed local test value; it is for local use only.

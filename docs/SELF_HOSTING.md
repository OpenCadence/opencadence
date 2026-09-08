# Self-hosting OpenCadence Community

The supported self-hosted configuration is **one OpenCadence container, one persistent local Docker volume, and localhost-only port publishing**. It requires Docker Engine with the Compose plugin and no cloud account.

> **Security boundary:** OpenCadence Community has no login, authorization, tenant isolation, TLS termination, or rate limiting. The Compose file deliberately publishes only on `127.0.0.1`. Do not expose the app directly on a LAN or the public internet. Remote access requires an externally managed authenticated access layer, TLS, and a reverse proxy. A reverse proxy alone does not add authentication. OpenCadence rejects request hostnames other than localhost by default.

## Install and start

```bash
git clone https://github.com/OpenCadence/opencadence.git opencadence
cd opencadence
docker compose up --build -d
```

Open <http://127.0.0.1:3000>. On first run, choose the fictional example workspace or an empty workspace. To use another localhost port:

```bash
CADENCE_PORT=3002 docker compose up -d
```

Check status and logs with `docker compose ps` and `docker compose logs -f cadence`. The health check opens the database through `/api/revision`.

The container includes the exact OpenCadence source and build inputs at `/usr/src/opencadence`, with project notices under `/app` and dependency license files under `/usr/share/licenses/opencadence-dependencies`. The build removes Next.js image-optimisation libraries because OpenCadence serves its brand assets directly and does not use that feature.

## Persistent storage

The named `cadence-data` volume is mounted at `/app/data`, and `DATABASE_PATH` points to `/app/data/cadence.sqlite`. Keep exactly **one** application replica attached to this SQLite database. Do not use ephemeral storage, a network filesystem, or multiple app containers. Container replacement preserves the named volume; `docker compose down -v` **deletes it** and must not be used unless you intend to erase the workspace.

To inspect the volume name:

```bash
docker volume ls --filter name=cadence-data
```

## Back up

The image includes the same WAL-consistent backup utility as a source installation. Backups placed under `/app/data/backups` persist in the named volume.

```bash
docker compose exec cadence node scripts/backup.mjs
# Copy the reported file to storage outside Docker:
docker compose cp cadence:/app/data/backups/<reported-file>.sqlite ./
```

The first command may run while the app is up. It verifies the backup with SQLite’s integrity check and creates the file with owner-only permissions on POSIX systems. Keep exported backup files private: they contain client information and notes.

The in-volume copy is not protection from volume deletion or host failure. Export backups to a different disk or an off-host destination. For example, a scheduled POSIX shell job can create a named backup, copy it outside Docker, and retain 30 days:

```bash
set -eu
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
inside="/app/data/backups/cadence-$stamp.sqlite"
mkdir -p "$HOME/opencadence-backups"
chmod 700 "$HOME/opencadence-backups"
docker compose exec -T cadence node scripts/backup.mjs "$inside"
docker compose cp "cadence:$inside" "$HOME/opencadence-backups/cadence-$stamp.sqlite"
chmod 600 "$HOME/opencadence-backups/cadence-$stamp.sqlite"
find "$HOME/opencadence-backups" -type f -name 'cadence-*.sqlite' -mtime +30 -delete
```

Choose retention and off-host storage that fit your needs. Monitor failed jobs and backup age. Regularly restore a backup into an isolated test volume and check representative records; an untested backup process is incomplete.

## Restore

1. Stop the application: `docker compose stop cadence`.
2. Preserve the current volume before changing it (for example, make and export a backup first).
3. Copy the selected standalone backup into the volume through a temporary container:

```bash
docker compose run --rm --no-deps \
  -v "$PWD/backup.sqlite:/tmp/restore.sqlite:ro" \
  cadence sh -c 'rm -f /app/data/cadence.sqlite /app/data/cadence.sqlite-wal /app/data/cadence.sqlite-shm && cp /tmp/restore.sqlite /app/data/cadence.sqlite'
```

4. Start and verify: `docker compose up -d`, then open the app and check important records.

Never replace only the main database while OpenCadence is running. The `-wal` and `-shm` sidecars belong to the old database and must not remain during restore.

## Run from source

Use Node.js 22.13 or newer and pnpm. After `pnpm install`, build once and run the production server rather than keeping the development server running:

```bash
pnpm build
pnpm start
```

The server binds to `127.0.0.1` by default. Run it under a process supervisor that restarts failed processes and preserves the project’s `data/` directory. `DATABASE_PATH` in a project-root `.env.local` can select another database file. OpenCadence sets newly created database and backup files to owner-only permissions on POSIX systems; administrators remain responsible for the permissions and backups of parent directories they supply.

For a source backup, run `pnpm backup`. To restore, stop OpenCadence, preserve the current database, remove its `-wal` and `-shm` sidecars, copy the standalone backup to `DATABASE_PATH`, then start OpenCadence and verify important records.

Before a source upgrade, make and export a backup, stop the process, run `git pull --ff-only` for the chosen commit or release, then run `pnpm install`, `pnpm build`, and restart the supervisor. Until immutable release tags are published, `main` is a development channel rather than a stable deployment target.

## Upgrade

1. Run and export a backup using the currently installed image.
2. Stop the app: `docker compose stop cadence`.
3. Fetch the desired release (`git pull --ff-only` when tracking the repository).
4. Rebuild and start: `docker compose up --build -d`.
5. Check `docker compose ps`, inspect logs, and verify important records in the UI.
6. Retain the pre-upgrade backup until verification is complete.

Schema migrations run automatically in one write transaction. An older OpenCadence image refuses a database created by a newer schema, so restoring the pre-upgrade backup is the rollback path.

## Remote access

Account-free localhost operation is the Community default. If an administrator intentionally enables remote access, they must add the public hostname to `CADENCE_ALLOWED_HOSTS`. Entries are exact, comma-separated hostnames; ports are optional and wildcard subdomains are not supported. For example:

```bash
CADENCE_ALLOWED_HOSTS=cadence.example.com docker compose up --build -d
```

This setting only permits the reverse proxy hostname. It does not add access control. Administrators are responsible for all of the following outside OpenCadence:

- authenticated access and authorization before requests reach the app;
- TLS termination and secure session configuration;
- reverse-proxy request limits and security maintenance;
- host firewall rules, disk-space monitoring, and private backup handling;
- ensuring only one OpenCadence process uses the SQLite file.

Do not publish port `3000` on `0.0.0.0` and do not describe this unauthenticated build as safe for direct public exposure. Monitor container health and restarts, free disk space, and the age and outcome of external backups.

## Known limitations

Community is single-user and single-instance. It has no accounts, cloud sync, collaboration, file uploads, background reminders, or built-in remote-access protection. Dates use the browser's local calendar. MCP is a local stdio process and is not included as a network service in the container setup.

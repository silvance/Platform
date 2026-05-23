# Operator runbook

Everyday operations for a CICyberLab VPS deployment. Each section
is a recipe — copy-paste-able, no surprises.

## Layout assumed by this runbook

```
/opt/citrain                          ← cloned repo
/opt/citrain/deploy/scripts/          ← deploy + ops scripts
/opt/citrain/deploy/env/vps.env       ← secrets (chmod 600)
/var/lib/citrain/                     ← persistent data (Postgres + artifacts)
/etc/caddy/Caddyfile                  ← Caddy config
/var/log/citrain-deploy.log           ← deploy history
```

If your install differs, override the environment variables the
deploy script reads (see `deploy-vps.sh --help`).

## Routine: deploy the latest `main`

After a PR is merged to `main`:

```bash
sudo /opt/citrain/deploy/scripts/deploy-vps.sh
```

What that does, in order:

1. Sanity-check: repo + env + docker present, working tree clean.
2. `git pull --ff-only origin main`.
3. `docker compose up -d --build` against `deploy/docker-compose.vps.yml`.
4. `prisma migrate deploy` inside the running api container.
5. Wait for `http://127.0.0.1:4000/v1/readyz` (60-second timeout).
6. Append an audit line to `/var/log/citrain-deploy.log`.

Flags:

- `--seed` — also re-run the seed script. Idempotent — only
  needed when content scenarios change (the seed script reports
  `created`/`updated`/`kept` per row).
- `--branch=foo` — deploy a branch other than `main` (rare).
- `--skip-build` — skip `--build` if you've already built locally
  and pushed images (rare on this single-host setup).
- `--dry-run` — print every command without running it. Safe to
  run on a sleepy production box to confirm what would happen.

The script bails (non-zero) on any failed step, so a bad
migration won't be followed by a misleading "healthy" log line.

## Post-merge deployment checklist

Walk through this every time after `deploy-vps.sh` returns 0:

- [ ] Visit `https://api.cicyberlab.com/v1/healthz` from off-host
      — expect HTTP 200 with `service: cicyberlab-api`.
- [ ] Visit the web URL. Sign in. Confirm the version-relevant
      change is in place (e.g. a new challenge appears, a fixed
      bug no longer reproduces).
- [ ] `tail -n 60 /var/log/citrain-deploy.log` — confirm the
      latest entry matches the merge commit.
- [ ] `docker compose --env-file deploy/env/vps.env -f
      deploy/docker-compose.vps.yml ps` — both `api` and `web`
      containers should be `Up (healthy)`.
- [ ] `docker compose ... logs --tail 100 api` — no errors after
      the `Nest application successfully started` line.
- [ ] If the PR touched the schema: run a
      `pg_dump --schema-only` and stash it as a checkpoint (see
      `backups.md`).

If anything's red, see "Rollback" below.

## Rollback (last-known-good)

```bash
cd /opt/citrain
# Find the previous deploy's SHA from the log
tail -n 5 /var/log/citrain-deploy.log

# Roll the working tree back to it
git checkout <previous-sha>

# Re-deploy. The script will detect "no new commits" and still
# rebuild + remigrate (no-op if the previous migration set
# already matches).
sudo deploy/scripts/deploy-vps.sh --branch=<previous-sha>
```

If the rollback also has the same broken migration applied, you
have a forward-only schema problem. See the **forward-only DB
migrations** section in `backups.md` for restoring from the
nightly dump.

## Adding a user

Two paths:

- **Admin UI** — sign in, go to **Admin → Users**, click **Add
  user**. The new user is auto-approved and can sign in
  immediately.
- **Self-registration** — point them at `https://<host>/register`.
  Their account lands in the pending queue (top of /admin/users)
  until you click **Approve**.

## Forgot the admin password

```bash
docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml \
               exec api node dist/scripts/reset-password.js \
                 --email <admin-email> --password '<new>'
```

Sessions for the target user are revoked automatically. Sign in
with the new password.

For history-safe input, use `--password-stdin`:

```bash
echo -n 'NewPassword' | docker compose ... exec -T api \
  node dist/scripts/reset-password.js --email <admin-email> \
  --password-stdin
```

## Backups + restore

See `docs/backups.md` for the full procedure. Quick reference in
`docs/backup-restore-checklist.md`.

Operational rule of thumb: do a **monthly restore drill** into a
scratch DB. A backup you've never restored is a wish, not a
backup.

## Where the deploy script lives + how to update it

The script is part of the repo (`deploy/scripts/deploy-vps.sh`),
so it updates itself on every `git pull`. After a deploy you can
diff to see if the script changed:

```bash
git log -1 --stat -- deploy/scripts/deploy-vps.sh
```

If you've customised it for your environment, prefer
environment-variable overrides (the script reads them at the top)
over local edits — that way you don't get merge conflicts on the
script file.

## Things that have actually broken on this stack

A non-exhaustive list of footguns documented because they bit
once already.

### `prisma migrate deploy` reports "no pending migrations" but the schema is wrong

This means the migration files were applied earlier but the
columns / enums you expected aren't there. Almost always cause:
the deployed binary is stale (built before the migration was
added). Rebuild the api image (`--build` flag is the default in
`deploy-vps.sh`).

### Login throttle locks out the admin during testing

The throttle is per real-client IP. From the VPS itself
`req.ip = 127.0.0.1`, which is the throttle key for ANY caller
hitting the API directly. If you've hammered the api with curl
from the host while debugging, your admin login may also be
locked.

Fix: restart the api container — the throttler is in-memory.

```bash
docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml \
               restart api
```

### "Account is pending admin approval" on a known-good email

Self-registration drops accounts into pending state. Admin needs
to click Approve in `/admin/users`. See also: the registration
endpoint deliberately returns the same response whether the
email is new or already registered (account-enumeration
defence) — so a stale account that you've already approved
isn't double-affected by a re-registration attempt; the
re-registration is a silent no-op.

### Caddy serves stale TLS after I changed the cert config

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

Reload, not restart — Caddy hot-reloads without dropping
connections.

### Postgres data directory permissions reset after volume restore

If you restored from a `pg_dump` into a new container and got
`could not change directory to "/var/lib/postgresql/data": ...`,
check the volume's UID matches the container's `postgres` user:

```bash
docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml \
               exec db chown -R postgres:postgres /var/lib/postgresql/data
docker compose ... restart db
```

## Useful one-liners

```bash
# How many pending self-registrations are waiting?
docker compose ... exec -T db psql -U citrain -d citrain -c \
  "SELECT count(*) FROM users WHERE approved_at IS NULL"

# How many sessions are currently live?
docker compose ... exec -T db psql -U citrain -d citrain -c \
  "SELECT count(*) FROM sessions WHERE revoked_at IS NULL AND expires_at > NOW()"

# Disk usage of the artifact storage:
du -sh /var/lib/citrain/artifacts

# Tail the api log:
docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml \
               logs -f --tail 100 api
```

## See also

- `docs/deployment.md` — initial install + environment setup
- `docs/backups.md` — backup + restore procedure
- `docs/known-limitations.md` — known constraints + workarounds
- `docs/post-merge-deploy.md` — the deploy-checklist version of
  the routine section above
- `docs/backup-restore-checklist.md` — the drill checklist

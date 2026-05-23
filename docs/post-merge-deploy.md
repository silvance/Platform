# Post-merge deployment checklist

Run this after every PR merge to `main`. Takes ~5 minutes
end-to-end on a healthy box.

## 1. Deploy

SSH to the VPS, then:

```bash
sudo /opt/citrain/deploy/scripts/deploy-vps.sh
```

If the PR changed seed content (challenges, scenarios), add `--seed`:

```bash
sudo /opt/citrain/deploy/scripts/deploy-vps.sh --seed
```

The script exits non-zero on any failed step. If it returns 0,
continue. If not, fix before doing anything else (see
`operator-runbook.md` § Rollback).

## 2. Confirm services + recent log

- [ ] `docker compose --env-file deploy/env/vps.env -f
      deploy/docker-compose.vps.yml ps`
      — `api` and `web` show `Up (healthy)`. Same for `db`.
- [ ] `docker compose ... logs --tail 60 api`
      — last few lines after `Nest application successfully
      started` should be empty of errors.
- [ ] `tail -n 1 /var/log/citrain-deploy.log`
      — the new entry's `new=` SHA matches the merge commit.

## 3. Confirm health from off-host

- [ ] `curl -sS https://api.cicyberlab.com/v1/healthz`
      → 200 with `service: cicyberlab-api`.
- [ ] `curl -sS https://api.cicyberlab.com/v1/readyz`
      → 200, `db: ok`.

If `/healthz` fails but the containers are healthy, the issue is
between Caddy and the api — check `journalctl -u caddy --since
"5 minutes ago"`.

## 4. Smoke-test the change the PR was about

This is the one step a script can't do for you. Open the
deployed web app, sign in, and walk through whatever the PR
touched:

- New challenge → open it, answer one question, confirm the
  debrief renders.
- Auth / admin change → exercise the path the PR's test plan
  named.
- Schema change → spot-check a representative row to make sure
  the data backfilled correctly.

If you don't know what to test, the PR description's **Test
plan** section is what to follow.

## 5. Recordkeeping (only if the PR changed the schema)

```bash
docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml \
               exec -T db pg_dump --schema-only -U citrain citrain \
  > "/var/lib/citrain/snapshots/$(date -u +%Y-%m-%d)_schema.sql"
```

That gives you a checkpoint you can diff against if something
goes sideways later.

## When to skip this checklist

You can't. The script automates steps 1–2; everything below is
human judgement. The point isn't ceremony — it's that an
operator who's *just* hit `deploy-vps.sh` and walked away has
seen the green checkmark but not actually validated the change
behaves correctly in production.

## See also

- `docs/operator-runbook.md` — full ops reference + recovery
  procedures
- `docs/backup-restore-checklist.md` — the every-month restore
  drill

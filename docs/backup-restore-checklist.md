# Backup + restore checklist

A drill, not a doc. The full procedure with rationale lives in
`docs/backups.md`. This page is the every-month "do you trust
your backups?" checklist.

## Monthly: restore a recent backup into a scratch DB

Doing this catches three classes of failure that you *cannot*
catch any other way:

1. The backup script wrote the file, but the file is empty or
   truncated.
2. The backup file exists and is well-formed, but it's missing
   tables / columns that a schema migration added (often because
   the backup script was last edited before that migration
   landed).
3. The dump restores cleanly, but the artifact storage tree on
   disk has drifted from the row IDs in the dump.

Do it monthly. Pick a Tuesday morning — quiet enough that you'll
notice the email if something fails, busy enough that an outage
caught here doesn't compound a real one.

### Steps

- [ ] Pick the most recent nightly dump:
      ```bash
      ls -lh /var/lib/citrain/backups/ | tail -3
      ```
      Confirm the file size looks like the previous month's (a
      sudden 10× shrink = some table got cleared, investigate).

- [ ] Spin up a scratch Postgres on a free port and restore:
      ```bash
      docker run --rm -d --name citrain-restore-test \
        -e POSTGRES_PASSWORD=temp -e POSTGRES_USER=citrain \
        -e POSTGRES_DB=citrain -p 55432:5432 \
        postgres:16
      sleep 4
      docker exec -i citrain-restore-test pg_restore \
        -U citrain -d citrain --clean --if-exists \
        < /var/lib/citrain/backups/citrain-YYYY-MM-DD.dump
      ```

- [ ] Sanity-count the big tables:
      ```bash
      docker exec citrain-restore-test psql -U citrain citrain -c \
        "SELECT 'users' AS t, count(*) FROM users
         UNION ALL SELECT 'scenarios', count(*) FROM scenarios
         UNION ALL SELECT 'questions', count(*) FROM questions
         UNION ALL SELECT 'scenario_progress', count(*) FROM scenario_progress"
      ```
      Compare against the production counts. They should be
      within hours of each other (the backup is from last night;
      production has had today's activity added).

- [ ] Confirm the migration table reflects the schema you expect:
      ```bash
      docker exec citrain-restore-test psql -U citrain citrain -c \
        "SELECT migration_name FROM _prisma_migrations ORDER BY applied_at DESC LIMIT 5"
      ```
      The most-recent few migration names should match
      `apps/api/prisma/migrations/` in the current `main`.

- [ ] Confirm the **artifact tarball** also extracts and the
      relative paths match:
      ```bash
      ARTIFACT_TAR=/var/lib/citrain/backups/artifacts-YYYY-MM-DD.tar.zst
      mkdir -p /tmp/citrain-restore-art
      tar --zstd -xf "$ARTIFACT_TAR" -C /tmp/citrain-restore-art
      # Pick a row and confirm the file is there:
      docker exec citrain-restore-test psql -U citrain citrain -tAc \
        "SELECT relative_path FROM artifacts ORDER BY created_at DESC LIMIT 1" \
        | xargs -I {} ls -lh /tmp/citrain-restore-art/{}
      ```
      File present + non-zero bytes = pass.

- [ ] Tear down:
      ```bash
      docker rm -f citrain-restore-test
      rm -rf /tmp/citrain-restore-art
      ```

- [ ] Record the date in
      `/var/log/citrain-restore-drill.log` so the next person to
      look knows when this last happened:
      ```bash
      echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) restore-drill OK by $(id -un)" \
        | sudo tee -a /var/log/citrain-restore-drill.log
      ```

## If a drill fails

Don't keep going. The drill IS the test; if it failed, you found
a real bug.

- If a table is missing → the backup script's `--exclude-table`
  or `--data-only` flag is wrong, or it's an older version that
  predates a schema migration. Edit the backup script, re-run a
  fresh backup, restart the drill.
- If the artifact tarball is missing or empty → the artifact
  step in the backup script is broken. Same fix: edit, take a
  fresh backup, re-drill.
- If counts are wildly off → check the backup script's log for
  the actual run (cron may have been silently failing for
  weeks).

In every case: the LAST known-good backup is what you'd restore
from in a real incident — find it before declaring the drill
complete.

## See also

- `docs/backups.md` — full procedure, schedule, retention
- `docs/operator-runbook.md` — everyday ops

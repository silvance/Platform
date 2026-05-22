# Post-M9 deployment smoke test

A 10-minute end-to-end check that the four authoring surfaces (M8–M9) +
the trainee workspace all work against a freshly migrated DB. Run this
on every install of a new build before sending users at it.

> **Scope.** This is a release smoke test, not a load test or a
> security audit. It exercises every code path the beta needs to
> survive its first day. Failures in this doc block the release.

## Prerequisites

- Postgres reachable, env file populated (mode-2 LAN: `deploy/env/local.env`;
  mode-3 VPS: `deploy/env/vps.env`).
- API + web built or images pulled.
- A second browser profile (or curl + a saved cookie) so you can run
  the admin and trainee threads in parallel without logging in and out.

## Checklist

Each step should complete in seconds. Numbers in `[brackets]` are the
expected HTTP status; anything else is a fail.

### 1. Fresh DB migration

```bash
# Mode 2 (LAN beta) — wipes the named volumes; only safe pre-launch.
docker compose --env-file deploy/env/local.env \
               -f deploy/docker-compose.local.yml down -v
docker compose --env-file deploy/env/local.env \
               -f deploy/docker-compose.local.yml up -d db

# Wait for db to be ready, then run migrations + seed via the api image.
docker compose --env-file deploy/env/local.env \
               -f deploy/docker-compose.local.yml run --rm api \
               sh -c "pnpm exec prisma migrate deploy && node dist/scripts/seed.js"
```

Expect: every migration prints `applied`, the seed prints two passwords
and a scenario list. **Copy the instructor + trainee passwords now** —
they are not stored anywhere else.

### 2. Seed sanity

```bash
curl -sS http://localhost:4000/v1/healthz | jq          # [200] status:"ok"
curl -sS http://localhost:4000/v1/readyz  | jq          # [200] ready:true
```

### 3. Admin login

In a browser, hit `/login` and sign in with the **instructor** seed
account. Confirm you land on `/scenarios`. The header should show
`displayName · admin`.

### 4. Create a draft challenge

Navigate to `/admin/challenges` → "New challenge" → fill:
- slug: `smoke-test-001`
- title: `Smoke test challenge`
- summary, brief: any non-empty text
- difficulty: 2
- skill areas: `bec` (at least one required)

Submit. You should land on `/admin/challenges/smoke-test-001/edit`. The
status chip should read `draft`.

### 5. Upload an artifact

In the Artifacts section, upload any small file. Use
`displayName=evidence.txt`, `kind=text`. The row should appear with a
non-zero size and a SHA-256 prefix. Confirm the bytes hit disk:

```bash
docker compose --env-file deploy/env/local.env \
               -f deploy/docker-compose.local.yml run --rm api \
               sh -c "find /data/artifacts/scenarios -type f -newer /tmp/.smoke-marker -printf '%p %s\n'"
```

(Touch `/tmp/.smoke-marker` before the upload if you want a clean
filter.) The file extension on disk is **kind-derived** (`.txt` here),
not `.html` or whatever displayName claimed.

### 6. Create an indicator set

In the Indicator sets section, add a set named `smoke-indicators`,
display name `Smoke test items`, with at least two items (e.g. `a` /
`Item A`, `b` / `Item B`). Save. The card should expand to show both
items.

### 7. Create all four question types

Add one of each in the Questions section:

| Type                | Quick payload                                   |
| ------------------- | ----------------------------------------------- |
| `multi_choice`      | 2 options, mark one correct                      |
| `confidence`        | expected range `3–5`                             |
| `text_match`        | acceptable answer: `foo`                         |
| `select_indicators` | reference the set above, mark one item correct   |

Each save should show a green `saved` badge. The questions list should
show four entries with the right type chips.

### 8. Publish the challenge

In the Metadata form, flip `status` from `draft` to `published`,
save. The status chip should re-render `published`.

### 9. User solves the challenge

In the second browser profile, sign in as the **trainee** seed
account. Open `/scenarios/smoke-test-001`. The progress strip should
read `Solved: 0 of 4`.

For each question, submit a correct answer:
- multi_choice: pick the marked-correct option
- confidence: enter `4`
- text_match: type `foo`
- select_indicators: check the marked-correct item

Each card should flip to "completed", the inline debrief should
appear, and the progress strip should advance. After the fourth, the
strip flips to `challenge complete`.

Spot check that the unsolved questions did **not** leak the answer
key — the JSON for an unsolved question's `answerKey` should be `null`
on `/v1/scenarios/smoke-test-001/progress`. (Quick check during the
solve loop.)

### 10. Artifact delete removes bytes

Back in the instructor session, delete the artifact from step 5. The
row vanishes from the Artifacts table. Then run the same `find`
command from step 5 — the file is gone from disk.

### 11. Backup and restore uploaded artifacts

Take a backup (mode 2 LAN):

```bash
/opt/citrain/scripts/backup-lan.sh
ls -lt /var/lib/citrain/backups/postgres/ | head -2
ls -lt /var/lib/citrain/backups/artifacts/ | head -2
```

Both should show a fresh `.dump` + `.tar.zst` timestamped within ~1
minute of each other.

Then test that the artifact byte cycle survives a restore. Pick any
artifact id from the DB:

```bash
docker compose --env-file deploy/env/local.env \
               -f deploy/docker-compose.local.yml exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT id, relative_path, sha256 FROM artifacts LIMIT 1;"
```

Note the `relative_path` + `sha256`. Confirm the corresponding file
inside the artifact tarball matches:

```bash
TAR=$(ls -t /var/lib/citrain/backups/artifacts/*.tar.zst | head -1)
docker run --rm -v "$TAR":/in:ro alpine sh -c "
  apk add --no-cache tar zstd >/dev/null
  tar --zstd -tf /in | grep '<relative_path-from-DB>'
"
```

The path must be present in the tarball. If it isn't, the backup ran
mid-write — re-run `backup-lan.sh` and try again. A passing match
proves the M9 upload path produces backup-survivable artifacts.

For the full restore drill, see the **Monthly restore drill** section
of `docs/backups.md`. That doc's procedure is unchanged by M9; the
storage layout is the same `scenarios/<scenarioId>/<uuid><ext>` tree
the seed writes to.

## Failure triage

| Step | If it fails                                                                              |
| ---- | ---------------------------------------------------------------------------------------- |
| 1    | Migration error → read the failing migration's filename. M7/M8 dropped attempts/enum values, that needs to run before authoring tables exist. |
| 2    | `readyz: ready:false` → the API container can't reach Postgres. Check `docker compose logs db`. |
| 3    | 307 to `/scenarios` for the instructor → wrong seed account. Re-run seed and copy the **instructor** password (top block). |
| 4    | 409 on create → slug already in use. Pick a different slug or wipe the DB. |
| 5    | 413 on upload → file over 25 MiB. Use a smaller file. |
| 5    | 400 on upload → `kind` is wrong for what you uploaded (e.g. a binary as `text`). Pick the right kind. |
| 7    | 400 on `select_indicators` → `correctId` not in the set. Use one of the item ids you created in step 6. |
| 9    | Question never marks completed → check the question's authored answer key. The grader is exact-match on MC/select_indicators; subset-of-correct is reported as partial credit but doesn't complete. |
| 10   | File still on disk after delete → bug; capture the DELETE response and the storage path, file an issue. |
| 11   | `pg_restore --list` errors → dump was truncated. Disk space, then re-run. |

## When the smoke test passes

Tag the release, push it, and let the LAN-beta users at it. If any
step above takes more than a few minutes (other than waiting for
containers to come up), something is wrong — investigate before
shipping.

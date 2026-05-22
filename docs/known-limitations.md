# Known limitations (beta)

What ci-train doesn't do yet, what's deliberately out of scope for the
challenge-lab framing, and what to expect to break in a beta install.
Read this **before** rolling out to your LAN beta cohort so user
feedback lands on real bugs rather than known gaps.

## Authoring

### No content-pack import/export

There's no `export` for a finished scenario or matching `import` on a
fresh deployment. Content authored in one install lives only in that
install's database + artifact directory. Moving a scenario between
hosts today means:

- DB: a `pg_dump` of just the scenario's rows (not currently a
  one-liner).
- Bytes: the scenario's artifact directory under
  `/var/lib/citrain/artifacts/scenarios/<scenarioId>/`.

A proper pack format is a likely follow-up milestone.

### No drag-drop reordering

Question + artifact ordinals are integer columns edited by hand
(artifacts: numeric input on the edit form; questions: not directly
editable in M9 — they're stamped in the order the admin added them).
A drag-drop UI is a polish item, not a beta blocker.

### No live markdown preview

Brief / prompt / debrief edits go into a plain `<textarea>`. The admin
sees rendered markdown only after saving and viewing as a user (or via
the workspace once published). For a beta cohort this is fine — for
content authoring at volume it's a tax.

## Terminology

### Internal role enum still says `instructor` / `trainee`

The product framing shipped in M7 — "challenge lab", "user solves
challenges" — but the underlying `Role` enum, the
`scenario_progress.trainee_user_id` column, and a few service-layer
comments still use the older `instructor` / `trainee` words. The
user-facing UI says **admin / user** + **challenge / solved**; the
internals will catch up in a future polish pass.

This is cosmetic. The role *check* works the same either way (
"instructor" maps to admin, "trainee" maps to user).

## Deletion / data lifecycle

### Scenario delete cascades, including artifact bytes (M9 onward)

`DELETE /admin/challenges/:slug`:

- DB cascades remove brief, questions, answer keys, indicator sets,
  scenario_progress rows, question_responses, and the artifact
  **metadata rows**.
- Individual `DELETE /admin/challenges/:slug/artifacts/:id` calls also
  remove the bytes from disk.
- **However**: a whole-scenario delete does *not* currently sweep the
  scenario's artifact directory. Stranded bytes live at
  `/var/lib/citrain/artifacts/scenarios/<old-scenario-id>/` until a
  separate cleanup pass removes them.

For a beta install this is a small disk leak. A periodic
"orphan-bytes" janitor is the right long-term fix; for the beta, a
manual `find ... -type d -empty -delete` after big purges is fine.

### Artifact rows survive seed re-runs only by ordinal

The seed deletes-and-recreates artifacts on every run for the seeded
scenarios. Admin-uploaded artifacts on those same scenarios are
**lost** if the seed runs again. Don't re-seed a production install
without backing up first — the documented restore procedure handles
this correctly, but `seed.js` on a live DB will purge admin uploads
that belong to a seeded scenario.

If you intend to keep admin-authored content alive across redeploys,
do **not** re-run the seed — the migrations are the only thing that
needs to run on upgrade.

## Reliability / scale

### Public beta is not HA-production

The deployment topology in `docs/deployment.md` is a **single-node
single-instance** stack:

- One API container, one Postgres container, one (optional) reverse
  proxy.
- No replication, no automatic failover.
- Backups + the monthly restore drill are the *only* DR mechanism.

That's an appropriate posture for a small LAN cohort or a single-tenant
VPS demo. It is **not** appropriate for a public-internet rollout at
scale. Before opening up to a wider audience you'd want, at minimum:

- A managed Postgres with a hot standby + PITR.
- Multiple API instances behind a load balancer.
- Object storage (S3 / R2 / B2) for artifact bytes instead of a single
  filesystem.
- A real CDN in front of the web app.

None of those are wired up today. The `ArtifactStorage` interface is
deliberately a plug-point for an S3 backend, but only the
LocalFileSystemStorage ships.

### Single-process file uploads

Artifact uploads stream through one Node process using multer's memory
storage with a 25 MiB hard cap. Many concurrent uploads on a small VPS
will compete for RAM. The cap keeps any single upload from going
runaway; the lack of streaming-to-disk + workers means you wouldn't
want 50 admins uploading at once.

For beta authoring (one or two admins) this is fine.

### No rate limiting on auth + submit

There's a global throttler (60 req/min/IP) but no specific abuse
controls on login or per-question submit. In a beta install behind a
LAN this isn't a concern. Before going public-internet you'd want a
real WAF + targeted rate limits.

## Question types

### `text_match` regex authoring is trusted-author-only

A `text_match` question can be authored with `regex: true`, and the
acceptable-answers list is then compiled as JS regex per submission.
The grader catches malformed patterns at runtime, but a pathological
regex authored by a malicious admin could cause expensive matches.

Treat the authoring role as trusted. The role-based gate already
enforces this — only `instructor` can author — but it's worth knowing
the surface exists.

## What this list is for

- Sets expectations for beta testers so feedback lands on real bugs.
- Tracks polish items that are deliberately deferred so we don't lose
  track of them.
- Documents the operational shape of the system so an operator can
  triage "is this a known gap or a real failure?"

This doc tracks **the state of the system**, not a roadmap of when
each item gets fixed.

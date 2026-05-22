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

## Deletion / data lifecycle

### Scenario delete cascades, including artifact bytes (M12 onward)

`DELETE /admin/challenges/:slug`:

- DB cascades remove brief, questions, answer keys, indicator sets,
  scenario_progress rows, question_responses, and the artifact
  metadata rows.
- M12 added a follow-up sweep that unlinks every artifact's bytes
  through the storage layer after the DB cascade succeeds.
  Individual `DELETE /admin/challenges/:slug/artifacts/:id` calls
  already removed bytes inline; whole-scenario delete now does too.
- Empty `scenarios/<scenarioId>/` directories may linger on disk
  until the next storage cleanup pass; the bytes themselves are
  gone. A periodic "orphan-bytes" janitor is still a sensible
  long-term operational piece.

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

## Abuse protection

### Login throttle uses BFF IP, not end-user IP

`POST /v1/auth/login` is rate-limited at 10 req/min/IP via the
NestJS throttler. The browser, however, does not call the API
directly — the login form posts to a Next.js server action, and
the server action calls `api.login()` server-side.

As a result, every browser-driven login request reaches the API
from the **web container's IP**, not the user's IP. The throttle
key is the BFF, not the human. A real attacker hitting the public
API endpoint directly (`api.cicyberlab.com/v1/auth/login`) still
gets keyed by their own IP and is throttled correctly; the gap is
only for traffic through the web BFF.

**Operational impact**: the protection works against a flat
external brute-force attack on the public endpoint. It does **not**
distinguish between two different browser users sharing the BFF —
tightening the limit would lock a whole LAN cohort behind one
bucket.

**Proper fix (deferred)**: a BFF-to-API forwarded-IP channel.

1. The web server action reads the trusted client IP from the
   incoming request headers (`x-forwarded-for` / `x-real-ip`,
   filtered against the reverse proxy's known trust boundary).
2. The web layer forwards that IP to the API in a controlled
   header (`X-CI-Train-Client-IP`) accompanied by a shared-secret
   header (`X-CI-Train-BFF-Secret`) only the BFF and API know.
3. The API ships a custom `ThrottlerGuard` whose `getTracker()`
   returns the forwarded IP **only** when the secret matches; for
   any other caller it falls back to `req.ip`.
4. Caddy (or whichever reverse proxy the install uses) must be
   configured to scrub inbound `X-CI-Train-*` headers from public
   clients so direct internet callers cannot spoof the BFF secret.

Until that lands, treat the login throttle as a coarse smoke alarm,
not a brute-force defense. The proper defense for the beta is to
keep the deployment behind a reverse proxy that the operator
controls and rotate seed credentials immediately.

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

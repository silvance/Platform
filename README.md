# ci-train

Scenario-based training platform for CI cyber, digital forensics, and
related investigative-reasoning skill areas. Designed to run locally on a
laptop or internal server, with a path to broader online deployment.

This repo has shipped milestones **M0** (repo skeleton + end-to-end
wiring), **M1** (local accounts, sessions, role guards, seed), **M2**
(scenario catalog + brief browse), **M3** (artifact storage + tabbed
workspace viewers), **M4** (EML viewer with header / auth-result
parsing), and **M5** (questions, attempts, debrief). Indicator-select
question type lands in M6; instructor authoring + review lands in M7.

## Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript — `apps/web`
- **Backend:** NestJS 10 + TypeScript — `apps/api`
- **Database:** PostgreSQL 16
- **Shared contracts:** Zod schemas + inferred TypeScript types — `packages/contracts`
- **Package manager:** pnpm workspaces
- **Containerization:** Docker Compose (web, api, db)

Strict separation between web, api, db, and (later) artifact storage. The
api never serves a UI; the web never talks to the db directly.

## Repository layout

```
apps/
  web/          Next.js 15 app (server-renders the home page, fetches API)
  api/          NestJS API (auth, scenarios, artifacts, attempts, health + Prisma migrations)
                /v1/healthz, /v1/readyz, /v1/hello,
                /v1/auth/login, /v1/auth/logout, /v1/auth/me,
                /v1/scenarios, /v1/scenarios/:slug,
                /v1/scenarios/:slug/artifacts/:id/content (streams bytes),
                /v1/scenarios/:slug/artifacts/:id/parsed (kind=eml only),
                /v1/scenarios/:slug/attempts (POST: start/get),
                /v1/attempts/:id (GET; PATCH/answers/:qid; POST /submit; GET /debrief)
packages/
  contracts/    Shared Zod schemas + inferred TS types
docker-compose.yml
.env.example
```

## Quick start (Docker Compose)

Prereqs: Docker 24+ and Docker Compose v2.

```bash
cp .env.example .env
docker compose up --build
```

Then:

- Web UI: <http://localhost:3000> — root redirects unauthenticated visitors to `/login`; after sign-in, instructors go to `/admin` and trainees to `/scenarios`.
- API liveness: <http://localhost:4000/v1/healthz> — always 200 if Node is responsive.
- API readiness (DB ping): <http://localhost:4000/v1/readyz> — returns 200 only when Postgres is reachable, 503 otherwise. The Compose API healthcheck targets `/v1/readyz`, so `depends_on: service_healthy` gates dependents on real DB readiness.

To shut down and wipe the DB volume:

```bash
docker compose down -v
```

## Local development (without Docker)

Prereqs: Node.js ≥ 20.11, pnpm 9, Postgres 16 reachable somewhere.

```bash
pnpm install
pnpm build:contracts          # contracts must be built once

# Terminal 1 — API
export DATABASE_URL=postgres://citrain:citrain_dev_password_change_me@localhost:5432/citrain
export API_PORT=4000
pnpm dev:api

# Terminal 2 — Web
export API_INTERNAL_URL=http://localhost:4000
export WEB_PORT=3000
pnpm dev:web
```

The contracts package emits to `packages/contracts/dist`; run
`pnpm --filter @ci-train/contracts dev` in a third terminal if you are
editing shared schemas.

## Scripts

| Command | Effect |
| --- | --- |
| `pnpm install` | Install all workspace deps (use the committed lockfile) |
| `pnpm build` | Build `contracts`, then `api` and `web` |
| `pnpm typecheck` | Run `tsc --noEmit` across every workspace |
| `pnpm test` | Runs the workspace test suites. Currently the API Jest unit tests (auth service, scenarios service, contracts, storage path safety, artifacts service, slug pipe, EML parser — 73 cases as of M4). Web Playwright/integration tests land in a later milestone. |
| `pnpm seed` | Create or refresh the seed instructor + trainee accounts and print their generated passwords once. |
| `pnpm dev:api` / `pnpm dev:web` | Run a single app outside Docker |
| `pnpm compose:up` | `docker compose up --build` |
| `pnpm compose:down` | `docker compose down -v` (wipes the db volume) |

## Seeding test accounts

After the API and db are running, create an instructor and a trainee:

```bash
# In docker compose:
docker compose run --rm api node dist/scripts/seed.js

# Outside docker:
pnpm --filter @ci-train/api seed
```

The seed script prints generated passwords to stdout exactly once. Re-running
regenerates passwords for the same emails (`instructor@example.local`,
`trainee@example.local`); override via `SEED_INSTRUCTOR_EMAIL` /
`SEED_TRAINEE_EMAIL`.

## Auth model (M1)

- **Password hashing:** Argon2id via `@node-rs/argon2` (m=19MiB, t=2, p=1).
- **Sessions:** opaque 256-bit random tokens, base64url-encoded. The DB
  only stores the SHA-256 hash of the token (`sessions.token_hash`) — a DB
  leak does not expose live session credentials.
- **Transport:** the API accepts `Authorization: Bearer <token>`. The web
  app sets the cookie with `HttpOnly`, `SameSite=Strict`, `Path=/`, and
  `Secure` **when `NODE_ENV=production`** (`Secure` is off in development
  so the cookie works over `http://localhost`). The browser never sees the
  raw API token; Next.js reads the cookie server-side and forwards the
  token via `Authorization` on internal fetches.
- **User-enumeration mitigation:** on a missed email, the login path
  performs a real Argon2id verify against a precomputed, throwaway hash
  initialized at startup. This evens out the ~30 ms timing gap between
  "no user" and "wrong password". It is not a perfect constant-time
  guarantee — a successful row fetch still costs a few extra ms — but it
  closes the dominant signal.
- **Reverse-proxy trust:** off by default. See `TRUST_PROXY` in
  `.env.example`. Enable only behind a proxy that sanitizes
  `X-Forwarded-*`; otherwise login throttling can be bypassed by spoofed
  headers.
- **CORS is intentionally disabled in M1.** The Next.js web app is the
  only HTTP client of the API in this milestone — it acts as a BFF:
  - The browser only ever talks to the **web** origin.
  - Next.js (server-side) holds the bearer token (read from the web's
    own HttpOnly cookie) and forwards it to the API via
    `Authorization: Bearer …`.
  - No `Access-Control-Allow-Origin` header is set; no preflight is
    answered. A direct cross-origin call from a browser to
    `:4000` will be blocked by the browser, by design.

  If a future milestone needs direct browser-to-API calls (e.g. a
  separate admin app, a Tauri/desktop client, or third-party
  integrations), introduce CORS with a **strict origin allowlist** —
  never `Access-Control-Allow-Origin: *` with credentials.
- **Guards:** a global `AuthGuard` requires a bearer token on every route
  except those marked `@Public()` (currently `/healthz`, `/readyz`,
  `/hello`, and `/auth/login`). `@Roles('instructor')` adds role gating;
  `RolesGuard` enforces it.
- **Throttling:** `/auth/login` is rate-limited to 10 requests / minute
  via `@nestjs/throttler`. Other routes have a 60 rpm default budget.

## Verifying M0/M1

After `docker compose up --build`, you should see:

1. `db` container becomes healthy (Postgres `pg_isready` passes).
2. `api` container becomes healthy. Two endpoints exist with distinct
   roles:
   - `GET /v1/healthz` — **liveness**. Returns `{ status: "ok", ... }`
     as long as the Node process is responsive; does not exercise the
     database. Suitable for orchestrator restart/liveness probes.
   - `GET /v1/readyz` — **readiness**. Runs a Postgres `SELECT 1` via
     Prisma and returns **200** when the DB is reachable, **503**
     otherwise. **This is the endpoint the Compose API healthcheck
     targets**, so `depends_on: service_healthy` gates dependents on
     real DB readiness — not just process liveness.
3. `web` container becomes healthy (`GET /api/health` on the web app returns ok).
4. Opening <http://localhost:3000> — the root path **redirects to
   `/login` unless a valid session cookie is already present**, in
   which case it redirects to `/admin` (instructor) or `/scenarios`
   (trainee). The M0 hello-payload landing page is gone as of M1.
5. <http://localhost:4000/v1/readyz> reports `ready: true` with the
   `postgres` check passing.
6. After seeding, signing in at <http://localhost:3000/login> redirects an
   instructor to `/admin` and a trainee to `/scenarios`. A trainee browsing
   to `/admin` is bounced back to `/scenarios` (role guard). Logging out
   clears the cookie, revokes the server-side session, and any further
   request to `/auth/me` with that token returns 401.
7. `/scenarios` lists the two seeded scenarios with skill-area / difficulty
   chips. `?skillArea=rf_awareness` filters to the awareness module
   scenario. `/scenarios/rf-awareness-clean-sweep-001` renders the brief
   with the awareness-only disclaimer banner above it. `/scenarios/bec-vendor-redirect-001`
   renders without the disclaimer. Unknown slugs return 404. Trainees
   cannot view drafts (the API returns 404 for trainees, not 403, so the
   existence of a draft isn't leaked).
8. Each scenario detail page shows a **tabbed workspace**. The "Brief"
   tab renders the markdown body; each artifact tab dispatches to a
   per-kind viewer (text / CSV / JSON / PDF / image). Artifact bytes
   flow browser → web proxy → API only — the raw bearer token never
   reaches the browser. PDF and image artifacts render inline (sandboxed
   iframe / `<img>` from a same-origin URL); text/CSV/JSON arrive as
   `Content-Disposition: attachment` from the API and are rendered
   server-side. A garbage `?artifact=<id>` falls back to the brief
   silently.

If `/v1/readyz` reports the postgres check as failing, the api is up but
cannot reach the db — check `DATABASE_URL` and that the `db` service is
healthy.

## Deployment notes

**Self-hosted (today):** the Compose file above is the supported path.
Run on any Docker host. Bind a reverse proxy (Caddy, nginx, Traefik) in
front of the `web` and `api` ports if you expose the platform on a
network.

**Online deployment (future):** services were designed to be deployable
to Kubernetes or a managed PaaS later without architectural change:

- Each app is a stateless container with a healthcheck endpoint.
- Postgres can be swapped for a managed service via `DATABASE_URL`.
- Artifact storage will be introduced behind an abstraction so a local
  filesystem backend and an S3-compatible backend can coexist.
- Configuration is environment-driven (`@nestjs/config`, Next.js env).
- The web → api boundary is HTTP-only and uses `API_INTERNAL_URL`, so
  the two can be deployed and scaled independently.

Kubernetes manifests / Helm chart are **not** included in M0 and are
deferred until the platform has real functionality worth deploying.

## Artifact storage (M3)

Artifact metadata lives in the `artifacts` table; **bytes live on
disk** under the configured storage root (`ARTIFACT_STORAGE_ROOT`,
default `/data/artifacts`). The API streams artifact bytes through a
single authenticated endpoint:

```
GET /v1/scenarios/:slug/artifacts/:id/content
```

with strict response headers (`X-Content-Type-Options: nosniff`,
strict `Content-Security-Policy` including `sandbox`, `ETag` =
`sha256-<digest>`). Trainees can stream only artifacts attached to
**published** scenarios; trainee access to a draft artifact returns
**404, not 403**, mirroring the scenario-detail leak protection.

Storage is abstracted behind an `ArtifactStorage` interface. M3 ships
a `LocalFileSystemStorage` implementation; an S3-compatible backend
can be added later by implementing the interface without changing
`ArtifactsService`. The local implementation **rejects absolute paths
and `..` traversal** and verifies the resolved path lives inside the
configured root before reading or writing.

The browser only ever talks to the web origin. Next.js runs an
authenticated proxy at `/scenarios/:slug/artifacts/:id/raw` that reads
the user's HttpOnly session cookie, forwards the bearer token to the
API server-side, and streams the response. The raw API token never
reaches the browser.

**Content-Type is canonicalized server-side**, not echoed from the DB
`mime_type` column. The API derives the served MIME from
`ArtifactKind`: `text/plain` for `text`, `text/csv` for `csv`,
`application/json` for `json`, `application/pdf` for `pdf`. For
`image`, only the explicit allowlist —
`image/png`, `image/jpeg`, `image/gif`, `image/webp` — is served
inline.

**SVG (`image/svg+xml`) is intentionally excluded** from the image
allowlist. SVG documents can carry JavaScript and other active
content; combined with `Content-Disposition: inline` they would
create an XSS surface even with a strict CSP and the `sandbox`
directive. Any image artifact whose stored MIME is outside the
allowlist (SVG, BMP, TIFF, or anything else) is downgraded to
`application/octet-stream` and served as `Content-Disposition:
attachment` so the browser downloads it rather than attempts to
render it.

The slug route parameter is validated by the shared `ScenarioSlug`
schema before any DB lookup: lowercase alphanumeric and hyphens
only, no leading/trailing hyphen, max 120 chars (matching the DB
column). The same pipe is applied to `/v1/scenarios/:slug` and
`/v1/scenarios/:slug/artifacts/:id/content`.
## EML viewer (M4)

The first investigative viewer. `kind=eml` artifacts get a dedicated
endpoint that parses the raw `.eml` server-side and returns a
structured JSON payload:

```
GET /v1/scenarios/:slug/artifacts/:id/parsed
```

Returns the subject, `From` / `To` / `Cc` / `Reply-To` / `Return-Path`
addresses, the parsed `Date`, the `Message-ID`, every header in
arrival order (capped), and a parsed `Authentication-Results` header
broken out per mechanism (`SPF`, `DKIM`, `DMARC`) with the verdict
and the free-form remainder. The text/plain body is returned with a
200 KB cap; HTML body presence is signalled as a byte count only
(the sanitized HTML render lands in **M4.1**). Attachment metadata
(filename, content-type, size, content-disposition) is returned;
inline attachment streaming is deferred. Endpoint enforces the same
role gate as `/content` and returns `400` for non-EML artifacts.

The web viewer highlights two BEC indicators automatically:

- **Reply-To differs from From** — common identity-spoof signal.
- **Return-Path domain differs from From domain** — common lookalike
  domain signal.

Authentication-Results verdicts get color chips: `pass` green, `fail`
red, `softfail` / `neutral` / `policy` / `temperror` / `permerror` /
`none` yellow, `missing` muted (and called out explicitly so trainees
read it as absence of evidence, not evidence of absence).

Parsing happens on the trusted API server (via `mailparser`) — the
web bundle has no mail-parsing dependency.

## What's intentionally not here yet

- Sanitized HTML body rendering for EML (M4.1)
- Inline download of embedded EML attachments (M4.1+)
- Question types, attempts, debriefs (M5)
- Instructor review UI (M7)
- Pack import / export (M8)
- Self-service user registration / password reset / MFA
- Python parser sidecar
- Optional Ollama feedback service
- S3-compatible artifact storage backend (interface in place; impl deferred)

These land in later milestones (M2 onward). See the architecture plan in
the project discussion for the full build order.

### Carry-over backlog from M1

- **Expired/revoked session cleanup** *(target: M2 / M2.1)*. The
  `sessions` table currently grows monotonically — expired rows are
  ignored by `resolveSession()` but never deleted, and `revokedAt`
  rows are kept indefinitely. Add a retention-aware sweep:
  - delete rows with `expires_at < now() - retention`;
  - delete rows where `revoked_at < now() - retention`.
  Run as either a Nest scheduled job (`@nestjs/schedule`) or a
  one-shot `pnpm --filter @ci-train/api sessions:prune` invocation
  triggered by cron. Retention default ~30 days, env-configurable.

## Scope note (RF / TSCM)

The `rf_awareness` skill area is **awareness-only**. The platform does
not and will not include offensive RF tooling, IMSI catcher
functionality, signal interception, jamming, or live SDR integration.
Contributions that introduce such functionality will be rejected. See
`SECURITY.md` (added in a later milestone) for the full content scope
policy.

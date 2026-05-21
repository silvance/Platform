# ci-train

Scenario-based training platform for CI cyber, digital forensics, and
related investigative-reasoning skill areas. Designed to run locally on a
laptop or internal server, with a path to broader online deployment.

This branch contains **Milestone 0** only: the repo skeleton, end-to-end
wiring between web → api → Postgres, and a Docker Compose stack. There is
no auth, no scenario engine, and no artifact handling yet.

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
  api/          NestJS API (/v1/healthz, /v1/readyz, /v1/hello)
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

- Web UI: <http://localhost:3000> — shows the API hello payload rendered server-side.
- API liveness: <http://localhost:4000/v1/healthz>
- API readiness (DB ping): <http://localhost:4000/v1/readyz>

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
| `pnpm test` | M0 placeholder — runs `typecheck`. A real test suite (Jest for the api, Playwright for the web) lands in a later milestone. |
| `pnpm dev:api` / `pnpm dev:web` | Run a single app outside Docker |
| `pnpm compose:up` | `docker compose up --build` |
| `pnpm compose:down` | `docker compose down -v` (wipes the db volume) |

## Verifying M0

After `docker compose up --build`, you should see:

1. `db` container becomes healthy (Postgres `pg_isready` passes).
2. `api` container becomes healthy (`GET /v1/healthz` returns `{ status: "ok", ... }`).
3. `web` container becomes healthy (`GET /api/health` on the web app returns ok).
4. Opening <http://localhost:3000> renders the API hello payload — the
   page is server-rendered by Next.js, which calls `http://api:4000/v1/hello`
   inside the Docker network. The response is validated against the
   `HelloResponse` Zod schema from `@ci-train/contracts`.
5. <http://localhost:4000/v1/readyz> reports `ready: true` with the
   `postgres` check passing.

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

## What's intentionally not here yet

- Authentication, user roles, sessions
- Scenario data model, persistence, importer
- Artifact storage, viewers, EML parser
- Question types, attempts, debriefs
- Instructor review UI
- Python parser sidecar
- Optional Ollama feedback service

These land in later milestones (M1 onward). See the architecture plan in
the project discussion for the full build order.

## Scope note (RF / TSCM)

The `rf_awareness` skill area is **awareness-only**. The platform does
not and will not include offensive RF tooling, IMSI catcher
functionality, signal interception, jamming, or live SDR integration.
Contributions that introduce such functionality will be rejected. See
`SECURITY.md` (added in a later milestone) for the full content scope
policy.

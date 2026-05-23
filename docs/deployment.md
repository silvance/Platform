# Deployment

ci-train supports three deployment modes. Pick the one that matches
your audience size; **all three use the same images and the same
schema** — only how the stack is exposed to the network changes.

| Mode                       | Audience                         | TLS               | Backups            | Doc'd config                                     |
| -------------------------- | -------------------------------- | ----------------- | ------------------ | ------------------------------------------------ |
| **1. Local-only**          | One developer or solo testing    | No                | Not required       | `deploy/docker-compose.local.yml` + `local.env`  |
| **2. LAN / internal beta** | A team on one network            | Optional (self-signed via Caddy `tls internal`) | **Required** | `deploy/docker-compose.local.yml` + `local.env` + `Caddyfile.example` (optional) |
| **3. Public internet**     | Open beta on `cicyberlab.com`    | **Required** (Let's Encrypt via Caddy) | **Required** | `deploy/docker-compose.vps.yml` (api) + Vercel (web) + Caddyfile.example |

Mode 3 explicitly **is not** a high-availability production
architecture. Kubernetes, Terraform, managed Postgres, S3-compatible
artifact storage, GitHub Actions deploy, and multi-node scaling are
all called out in the [Beyond beta](#beyond-beta) section as later
migration steps — **none of them are in scope for this milestone.**

## Design principles

The application code follows these principles so the same artifact
runs in all three modes:

- **No hardcoded URLs.** Every domain, CORS origin, DB connection
  string, and artifact storage root comes from environment variables.
- **API is always the authorization gate for artifacts.** Storage
  backend may change (local volume / S3 later) but artifact bytes
  only reach the browser through the authenticated API endpoint with
  strict CSP + nosniff.
- **Local artifact storage** (a host directory or named Docker
  volume) is acceptable for all three modes. S3-compatible storage is
  documented as a later migration path, not a current requirement.
- **Web is a BFF.** The browser only ever talks to the web origin;
  Next.js holds the session cookie and forwards `Authorization:
  Bearer …` to the API server-side. The raw API token never reaches
  the browser. CORS is therefore disabled on the API by design — see
  the root `README.md`'s auth section.

## Files in this section

```
deploy/
├── docker-compose.local.yml   ← modes 1 + 2 (local + LAN beta)
├── docker-compose.vps.yml     ← mode 3 (api + db only)
├── Caddyfile.example          ← TLS reverse proxy (modes 2 optional, 3 required)
└── env/
    ├── local.env.example      ← modes 1 + 2
    ├── vps.env.example        ← mode 3 (VPS side)
    └── vercel.env.example     ← mode 3 (Vercel side; checklist for the UI)

docs/
├── deployment.md   ← this file
└── backups.md      ← backup + restore procedure (modes 2 + 3)
```

# Mode 1 — Local-only

A single developer running everything on their laptop. No TLS, no
external access, no backups required (it's dev data).

## Requirements

- Docker Engine 24+ with Compose v2.
- The cloned repo at any path. (`/home/you/Platform`, etc.)

## Setup

```bash
cd Platform
cp deploy/env/local.env.example deploy/env/local.env
# Edit deploy/env/local.env if you want different bind hosts; defaults
# are fine for a laptop.
```

Defaults bind both `web` and `api` to `0.0.0.0`. For loopback-only,
set `API_BIND_HOST=127.0.0.1` and `WEB_BIND_HOST=127.0.0.1` in the
env file.

## Run

```bash
docker compose --env-file deploy/env/local.env \
               -f deploy/docker-compose.local.yml \
               up --build
```

Open `http://localhost:3000`.

## Seed accounts

In another terminal:

```bash
docker compose --env-file deploy/env/local.env \
               -f deploy/docker-compose.local.yml \
               run --rm api node dist/scripts/seed.js
```

Behavior depends on whether you set the bootstrap passwords in
`deploy/env/local.env` (M15):

| `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` | First run | Re-run |
|---|---|---|
| **set** | account created with that password | password rotated to env value (idempotent) |
| **unset** | account created with a random password, printed once | password is **left as is** — repeat runs don't surprise you |

Random passwords are printed to the container log exactly once.
Copy them into your password manager immediately. For repeatable
local deployments, set explicit passwords in `local.env`.

Forgot the password? Skip the log archaeology — run the
`reset-password` recovery script:

```bash
docker compose --env-file deploy/env/local.env \
               -f deploy/docker-compose.local.yml \
               exec api node dist/scripts/reset-password.js \
                 --email admin@example.local \
                 --password 'NewPasswordHere'
```

Or, on a running stack, change your own password via the web UI:
sign in → **Security** in the top nav.

## Tear down

```bash
docker compose --env-file deploy/env/local.env \
               -f deploy/docker-compose.local.yml \
               down -v        # -v wipes db + artifact volumes
```

# Mode 2 — LAN / internal beta

A dedicated machine on a local network hosting the stack for a small
team of instructors and trainees. Same compose file as mode 1, with
two operational differences:

- **Persistent volumes** are not wiped between restarts.
- **Backup discipline** matters — this is real data now. See
  `docs/backups.md`.

## Requirements

- A dedicated Linux machine on your LAN (mini-PC, NUC, repurposed
  desktop). 2 CPU / 4 GB RAM is plenty.
- Static IP or DHCP reservation so other devices can reach it
  reliably.
- LAN DNS entry (optional but recommended): e.g. `citrain.lan` → that
  static IP. Without LAN DNS, trainees just hit
  `http://<static-ip>:3000`.

## Setup

```bash
cd Platform
cp deploy/env/local.env.example deploy/env/local.env
$EDITOR deploy/env/local.env
```

Edits typically needed:

- **`POSTGRES_PASSWORD`** — change from the example value. The data
  is now real.
- **`API_BIND_HOST=0.0.0.0`** and **`WEB_BIND_HOST=0.0.0.0`** —
  default. Leave alone so LAN clients can connect.

## Run

```bash
docker compose --env-file deploy/env/local.env \
               -f deploy/docker-compose.local.yml \
               up -d --build
```

Trainees open `http://<host>:3000`.

## Optional — Caddy in front (LAN HTTPS)

Useful if you want the URL to be `https://citrain.lan` instead of
`http://citrain.lan:3000`. Edit `deploy/Caddyfile.example`:

- Change `api.cicyberlab.com` to e.g. `citrain.lan`.
- Uncomment the `tls internal` line. Caddy will mint a self-signed
  certificate; trainee browsers will need to accept it once.
- Add an additional block that fronts the web service:
  ```
  citrain.lan {
      tls internal
      reverse_proxy 127.0.0.1:3000
  }
  ```
- Set `WEB_BIND_HOST=127.0.0.1` (not `0.0.0.0`) so only Caddy can
  reach the web container.

## Health check

```bash
curl -sS http://<host>:4000/v1/healthz
curl -sS http://<host>:4000/v1/readyz
```

## Backups

**Mandatory** at this point — see `docs/backups.md`. The script there
works against `deploy/docker-compose.local.yml` as well as the VPS
compose; just point `COMPOSE` at the right `-f` path.

# Mode 3 — Public internet (Vercel + VPS)

The public-beta topology for `cicyberlab.com`:

```
                          ┌──────────────────────────┐
   Browser  ─── HTTPS ──▶ │       Vercel             │  apps/web (Next.js)
                          │  cicyberlab.com          │  auto-deploys from main
                          └──────────────┬───────────┘
                                         │ server-side fetch (HTTPS)
                                         │ Authorization: Bearer <token>
                                         ▼
                          ┌──────────────────────────┐
                          │  Ubuntu VPS              │
                          │  Caddy ── api.…lab.com   │  ← TLS reverse proxy
                          │     │                    │
                          │     ▼                    │
                          │  apps/api (Docker)       │  ← NestJS on 127.0.0.1:4000
                          │     │                    │
                          │     ▼                    │
                          │  Postgres 16 (Docker)    │  ← internal network only
                          │                          │
                          │  /var/lib/citrain/       │
                          │    ├ postgres/  (db)     │
                          │    ├ artifacts/ (api)    │
                          │    └ backups/   (cron)   │
                          └──────────────────────────┘
```

> **Single-node, not HA.** A reboot interrupts service for the
> duration. There is no replica, no automatic failover, no
> cross-region redundancy. Backups + a monthly restore drill carry the
> durability. Acceptable for personally-funded beta scale; flagged
> [below](#beyond-beta) as the threshold for moving on.

## VPS requirements

| Resource  | Minimum     | Notes                                                |
| --------- | ----------- | ---------------------------------------------------- |
| OS        | Ubuntu 24.04 | Debian 12 also fine.                                |
| vCPU      | 2           |                                                      |
| RAM       | 2 GB        | Argon2 password hashing wants memory; 2 GB is the floor. |
| Disk      | 40 GB SSD   |                                                      |
| Bandwidth | 1 TB/month  | Comfortable for beta scale (~150–300 trainees).      |
| Open ports| 22 / 80 / 443 | SSH source-restricted to admin IPs.                |

## DNS

| Record                  | Target                              | Hosted at   |
| ----------------------- | ----------------------------------- | ----------- |
| `cicyberlab.com`        | Vercel-provided IPs / `CNAME` alias | Vercel      |
| `api.cicyberlab.com`    | VPS public IP (A + AAAA)            | VPS         |

Wait for DNS to propagate (`dig +short api.cicyberlab.com`) before
the first Caddy start — Caddy fetches Let's Encrypt on the first
request and the ACME challenge needs the record live.

## Install Docker + Caddy on the VPS

```bash
apt update
apt install -y ca-certificates curl gnupg ufw fail2ban \
               postgresql-client zstd

# `postgresql-client` and `zstd` are needed by the backup/restore
# tooling in docs/backups.md — the backup script runs `pg_dump` inside
# the db container but uses host-side `pg_restore --list` to verify the
# dump opens, and the artifact tarball is `tar --zstd`.

# Docker engine + compose plugin.
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io \
               docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# Caddy.
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  > /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# Firewall.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## Data directories

```bash
mkdir -p /var/lib/citrain/{postgres,artifacts,backups}
chmod 700 /var/lib/citrain/postgres
chmod 750 /var/lib/citrain/artifacts
chmod 750 /var/lib/citrain/backups
```

## Clone + configure

```bash
git clone https://github.com/silvance/Platform.git /opt/citrain
cd /opt/citrain
cp deploy/env/vps.env.example deploy/env/vps.env
chmod 600 deploy/env/vps.env
$EDITOR deploy/env/vps.env
```

Required edits:

- **`POSTGRES_PASSWORD`** — `openssl rand -base64 32`.
- **`SEED_ADMIN_EMAIL` / `SEED_USER_EMAIL`** — your real bootstrap
  addresses. **Must be different** (case-insensitively); the seed
  refuses to run otherwise. Use a plus-alias
  (`james+user@cicyberlab.com`) if you only have one mailbox.
- **`SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD`** — generate with
  `openssl rand -base64 24` (one per account). These are the real
  login passwords humans type. See the "Seed" section below.
- **`BFF_FORWARD_SECRET`** — `openssl rand -hex 32`; must match the
  Vercel project env (M14).
- **`TRUST_PROXY=1`** — leave alone. Critical for login throttling.

## Caddy

```bash
cp /opt/citrain/deploy/Caddyfile.example /etc/caddy/Caddyfile
$EDITOR /etc/caddy/Caddyfile   # change api.cicyberlab.com to your real domain
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
journalctl -u caddy -f         # watch the cert fetch on first request
```

## Build and run the API stack

```bash
cd /opt/citrain
docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml \
               up -d --build
```

The api container's entrypoint runs `prisma migrate deploy` on boot,
so the schema is always in sync with the deployed image.

Watch boot:

```bash
docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml \
               logs -f api
```

Expect `Prisma connected.` and `ci-train api listening …`.

## Seed (one-time on a fresh deploy)

For a VPS deploy, **set `SEED_ADMIN_PASSWORD` and
`SEED_USER_PASSWORD` in `deploy/env/vps.env` before seeding** (M15).
Without them the seed prints random passwords once to the container
log and never anywhere else — fragile after a restart, lost the
moment the log is rotated, and impossible to share with another
operator without re-running through the recovery script.

Generate fresh values:

```bash
openssl rand -base64 24   # run once per account
```

Paste each into `vps.env`. Then seed:

```bash
docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml \
               run --rm api node dist/scripts/seed.js
```

The seed is idempotent: re-running it with the same env values is a
no-op; changing `SEED_*_PASSWORD` and re-running rotates the
password to the new value. Leaving `SEED_*_PASSWORD` unset on a
re-run **does not** rotate the password — so passwords you've
already changed through the web UI or the recovery script stick.

After the seed, sign in to the web app with `SEED_ADMIN_EMAIL` +
`SEED_ADMIN_PASSWORD`, and from **Admin → Users** add additional
trainees / admins as needed. Encourage every account to rotate
their password via **Security** in the top nav on first login.

### Emergency password reset (forgot the admin password)

The `reset-password` recovery script is the supported way to
recover from a lost password — never edit the `users` table by
hand.

```bash
docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml \
               exec api node dist/scripts/reset-password.js \
                 --email admin@cicyberlab.com \
                 --password 'NewPasswordHere'
```

Or, to keep the password out of shell history and `ps`:

```bash
echo -n 'NewPasswordHere' | docker compose ... exec -T api \
  node dist/scripts/reset-password.js \
    --email admin@cicyberlab.com --password-stdin
```

The script revokes every active session for the target user, so
they will need to sign in again with the new password. It refuses
passwords shorter than 10 characters and refuses to create
accounts.

### `SEED_*` vs other secrets

These are easy to mix up. They are NOT interchangeable:

| Env var | What it protects | Where it's used |
|---|---|---|
| `POSTGRES_PASSWORD` | the Postgres role the api connects as | `DATABASE_URL` |
| `BFF_FORWARD_SECRET` | the BFF → API forwarded-client-IP channel | rate-limit keying (M14) |
| `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` | **the actual web-login password a human types** | login form, `/me/security`, `/admin/users` |

The first two never appear on the login screen. The third is the
one your operators sign in with.

## Health check

```bash
# From the VPS itself:
curl -sS http://127.0.0.1:4000/v1/healthz
curl -sS http://127.0.0.1:4000/v1/readyz

# From off-host, through Caddy + TLS:
curl -sS https://api.cicyberlab.com/v1/healthz
curl -sS https://api.cicyberlab.com/v1/readyz
```

`/v1/healthz` is process liveness. `/v1/readyz` runs a Postgres
`SELECT 1` and returns **200** when reachable, **503** when not.

## Configure Vercel for `apps/web`

In the Vercel dashboard, create a project pointing at this repo.

| Field                | Value                                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| Root directory       | `apps/web`                                                                     |
| Framework            | Next.js (auto-detect)                                                          |
| Install command      | `pnpm install --frozen-lockfile`                                               |
| Build command        | `pnpm --filter @ci-train/contracts build && pnpm --filter @ci-train/web build` |

Environment variables — set these in **Settings → Environment
Variables** (see `deploy/env/vercel.env.example` for the same list):

| Variable                  | Value                            |
| ------------------------- | -------------------------------- |
| `API_INTERNAL_URL`        | `https://api.cicyberlab.com`     |
| `NODE_ENV`                | `production`                     |
| `NEXT_TELEMETRY_DISABLED` | `1`                              |

Bind `cicyberlab.com` to the project. Add a redirect for
`www.cicyberlab.com → cicyberlab.com`.

### Disconnect the `platform-api` Vercel project

There is currently a Vercel project named `platform-api` that tries
to build NestJS on every PR and fails. **Remove it** once the VPS API
is serving traffic: Vercel dashboard → `platform-api` → Settings →
"Remove Project."

## Manual deploy procedure (mode 3 only)

```bash
cd /opt/citrain
git fetch origin
git checkout main
git pull --ff-only

docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml build api

docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml up -d api

docker compose --env-file deploy/env/vps.env \
               -f deploy/docker-compose.vps.yml logs --tail=200 api
```

Migrations run automatically on container start. **For a risky
migration, take a manual backup first** — see `docs/backups.md` for
the one-line command.

The frontend auto-deploys from `main` via Vercel. No VPS action
needed for frontend updates.

## Operational basics (modes 2 + 3)

### Logs

```bash
docker compose --env-file <env> -f <compose> logs api db
# Mode 3 also has Caddy:
journalctl -u caddy -f
tail -f /var/log/caddy/api.access.log
```

### Disk usage

Monitor `/var/lib/citrain/`. Alert at 80%.

### Off-host health check

For mode 3, add `https://api.cicyberlab.com/v1/readyz` to an external
uptime monitor (Uptime Robot, Better Uptime, healthchecks.io). Page
on >3 consecutive failures.

## Security recap

These hold in all three modes; what changes is the threat surface
(LAN-only vs. public-internet exposure).

- **TLS** is terminated at Caddy (modes 2 optional, 3 required). The
  api container binds to `127.0.0.1:4000` only in mode 3 — never
  publish it on the public interface.
- **`TRUST_PROXY`** must match the proxy layout. The login throttler
  keys on `req.ip` for direct API callers:
  - **mode 1 / 2 without Caddy**: `TRUST_PROXY=false`.
  - **mode 2 with Caddy / mode 3**: `TRUST_PROXY=1`.
  - Setting it to `true` (all hops trusted) anywhere lets clients
    rotate spoofed `X-Forwarded-For` per request and defeat per-IP
    throttling.
- **`BFF_FORWARD_SECRET`** (M14) controls the BFF → API forwarded-IP
  channel. The web app calls `/v1/auth/login` server-side, so
  without this channel every browser-driven login looks to the API
  like it came from the BFF container's IP — tightening the
  throttle would pool a whole LAN cohort behind one bucket.
  - **mode 1**: leave unset. Throttler falls back to `req.ip`;
    safe for a single-developer setup.
  - **mode 2 with multiple users / mode 3**: REQUIRED. Generate
    with `openssl rand -hex 32` and set the **same value** on
    both sides — for mode 3 that means the Vercel project env
    AND the VPS api env. The web BFF stamps `X-CI-Train-Client-IP`
    and `X-CI-Train-BFF-Secret` on outbound API calls;
    `BffForwardedThrottlerGuard` validates the secret (timing-safe)
    and uses the forwarded IP as the throttle key. Any failure (no
    secret, wrong secret, malformed IP) silently falls back to
    `req.ip` — no failure mode raises the rate limit.
  - **The trust boundary is the secret itself, not the network
    path.** In mode 3 the BFF lives on Vercel and reaches the API
    over the public `api.cicyberlab.com` Caddy vhost, the same
    path as any internet client. So `Caddyfile.example`
    intentionally does NOT strip inbound `X-CI-Train-*` headers —
    stripping them would also kill the legitimate Vercel BFF
    traffic. A direct curl with a guessed client IP and no secret
    (or wrong secret) is harmless: the guard rejects the override
    and keys on `req.ip` instead. Only add a Caddy strip if your
    deployment has a separate trusted internal path for the BFF
    (e.g. a sidecar BFF on the VPS or a WireGuard tunnel) — in
    that case strip on the public vhost and pass through on the
    internal one.
  - **Rotation**: changing `BFF_FORWARD_SECRET` requires updating
    both sides. The web side picks up env changes on the next
    Vercel deploy; the api side picks them up on the next request
    (the secret is read lazily on each `getTracker` call).
- **`POSTGRES_PASSWORD`** lives in the env file (mode 1/2:
  `deploy/env/local.env`; mode 3: `deploy/env/vps.env`). File mode
  600. Never in the repo. Rotate by editing and restarting the
  stack.
- **Session tokens** are SHA-256-hashed in the database; the raw
  token only exists in the user's browser cookie (mode 3: set by
  Next.js on Vercel) and in the `Authorization: Bearer` header on
  internal hops.
- **Artifact bytes** are served only through the authenticated API
  endpoint with strict CSP + `X-Content-Type-Options: nosniff`. The
  storage layer rejects absolute paths and `..` traversal.
- **CORS** is disabled. Adding direct browser → API access requires a
  strict origin allowlist — never `*` with credentials.

## Beyond beta

The single-node Mode 3 topology is acceptable for the
personally-funded beta because:

- The expected user volume (~150–300 trainees) fits comfortably in
  2 GB RAM.
- Artifact totals stay under a few GB at full scenario coverage.
- A reboot is acceptable downtime at this audience size.

**Trigger conditions** for moving off this topology — any of:

- Sustained user count crosses ~500 active trainees / month.
- Artifact volume crosses ~10 GB or contains data under retention
  controls demanding audit-grade durability.
- A funded pilot requires HA + DR commitments stronger than "single
  VPS, nightly backups, monthly restore drill."

Migrate one component at a time, in this order:

1. **Move Postgres to a managed provider** (RDS / Cloud SQL / Neon).
   Restore the most recent `pg_dump`, update `DATABASE_URL`, restart
   the api container, drop the local `db` service.

2. **Move artifact storage to an S3-compatible bucket.**
   `apps/api/src/modules/artifacts/storage/artifact-storage.ts` was
   designed for this — an `S3CompatibleStorage` slots in behind the
   `ARTIFACT_STORAGE` DI token without touching `ArtifactsService`.
   One-time migration: walk `/var/lib/citrain/artifacts/`, upload each
   file to the bucket, verify SHA-256, switch the storage backend.
   `relative_path` is opaque to the API — no DB migration required.

3. **Scale the API horizontally** behind a load balancer (two VPSes,
   Fly, Render, App Runner — whichever fits the budget). Session
   storage is already DB-backed; no Redis needed.

4. **Automated deploys + staging environment.** A GitHub Actions
   workflow that builds the api image, pushes to a registry, and
   triggers a rolling update on the VPS / managed runtime. Staging =
   a second VPS at a smaller size, pointing at a forked DB.

5. **(Optional) Move the frontend off Vercel** if contract or threat
   model precludes Vercel. The `apps/web/Dockerfile` already produces
   a Next.js standalone image suitable for self-hosting behind the
   same Caddy.

Each step is independently revertible. The beta topology gets us into
the field at single-digit-dollars-per-month — re-architect when usage
data justifies it, not before.

## See also

- `docs/backups.md` — backup + restore procedure (modes 2 + 3).
- Root `README.md` — auth model, architecture overview, milestone log.
- `deploy/env/*.example` — env-var checklists per mode.

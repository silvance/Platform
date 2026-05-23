#!/usr/bin/env bash
#
# CICyberLab — automated VPS deploy.
#
# What this does (in order):
#   1. Sanity-check: repo, env file, docker, postgres-client are present.
#   2. Snapshot the current dist + database name in a deploy log so we
#      can answer "what changed and when" later.
#   3. `git pull --ff-only` on the target branch.
#   4. `docker compose build` + `up -d` (rebuilds api + web images).
#   5. `prisma migrate deploy` against the running api container.
#   6. Optional: `node dist/scripts/seed.js` (idempotent — pass --seed).
#   7. Wait for /v1/readyz to return 200 (timeout: 60s).
#   8. Print a short summary + the deploy-log entry.
#
# Safe to re-run. Fails fast on any step that returns non-zero, so a
# bad migration won't be followed by a "looks healthy" log line.
#
# Usage:
#   sudo /opt/citrain/deploy/scripts/deploy-vps.sh             # standard
#   sudo /opt/citrain/deploy/scripts/deploy-vps.sh --seed      # also re-seed
#   sudo /opt/citrain/deploy/scripts/deploy-vps.sh --branch=foo
#   sudo /opt/citrain/deploy/scripts/deploy-vps.sh --skip-build (faster
#                                                                if you
#                                                                already
#                                                                rebuilt)
#   sudo /opt/citrain/deploy/scripts/deploy-vps.sh --dry-run
#
# Environment:
#   CITRAIN_REPO_DIR    default: /opt/citrain
#   CITRAIN_COMPOSE     default: $CITRAIN_REPO_DIR/deploy/docker-compose.vps.yml
#   CITRAIN_ENV         default: $CITRAIN_REPO_DIR/deploy/env/vps.env
#   CITRAIN_API_URL     default: http://127.0.0.1:4000  (used for /readyz polling)
#   CITRAIN_DEPLOY_LOG  default: /var/log/citrain-deploy.log

set -euo pipefail

# ─── arg parsing ────────────────────────────────────────────────
BRANCH="main"
DO_SEED=0
SKIP_BUILD=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --seed)        DO_SEED=1 ;;
    --skip-build)  SKIP_BUILD=1 ;;
    --dry-run)     DRY_RUN=1 ;;
    --branch=*)    BRANCH="${arg#--branch=}" ;;
    --help|-h)
      sed -n '/^# /{s/^# \?//;p}' "$0" | head -40
      exit 0
      ;;
    *)
      echo "Unrecognized argument: $arg" >&2
      exit 2
      ;;
  esac
done

# ─── config (env-overridable) ───────────────────────────────────
REPO_DIR="${CITRAIN_REPO_DIR:-/opt/citrain}"
COMPOSE_FILE="${CITRAIN_COMPOSE:-$REPO_DIR/deploy/docker-compose.vps.yml}"
ENV_FILE="${CITRAIN_ENV:-$REPO_DIR/deploy/env/vps.env}"
API_URL="${CITRAIN_API_URL:-http://127.0.0.1:4000}"
DEPLOY_LOG="${CITRAIN_DEPLOY_LOG:-/var/log/citrain-deploy.log}"

say() { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  (dry-run) %s\n' "$*"
  else
    "$@"
  fi
}

# ─── preflight ──────────────────────────────────────────────────
say "preflight"
[ -d "$REPO_DIR" ] || die "repo dir not found: $REPO_DIR"
[ -f "$COMPOSE_FILE" ] || die "compose file not found: $COMPOSE_FILE"
[ -f "$ENV_FILE" ] || die "env file not found: $ENV_FILE"
command -v docker >/dev/null || die "docker missing"
docker compose version >/dev/null 2>&1 || die "docker compose plugin missing"
command -v git >/dev/null || die "git missing"
command -v curl >/dev/null || die "curl missing"

cd "$REPO_DIR"

# Confirm we're on the requested branch and the working tree is
# clean. Operational rule: production deploys come from a
# committed, pushed branch — never from a dirty checkout.
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  warn "checked-out branch is '$CURRENT_BRANCH', deploying '$BRANCH'"
  run git checkout "$BRANCH"
fi
if ! git diff --quiet HEAD --; then
  die "working tree is dirty. Commit / stash before deploying."
fi

OLD_REV=$(git rev-parse HEAD)

# ─── pull ───────────────────────────────────────────────────────
say "git pull --ff-only origin $BRANCH"
run git fetch --quiet origin "$BRANCH"
run git pull --ff-only origin "$BRANCH"

NEW_REV=$(git rev-parse HEAD)
if [ "$OLD_REV" = "$NEW_REV" ]; then
  say "no new commits ($OLD_REV) — proceeding anyway (rebuild + migrate are still useful)"
else
  say "advancing from $OLD_REV → $NEW_REV"
  if [ "$DRY_RUN" -eq 0 ]; then
    git --no-pager log --oneline "$OLD_REV..$NEW_REV"
  fi
fi

# ─── build + up ─────────────────────────────────────────────────
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

if [ "$SKIP_BUILD" -eq 1 ]; then
  say "skip-build: bringing services up without rebuild"
  run "${COMPOSE[@]}" up -d
else
  say "build + up -d --build (this is the slow step)"
  run "${COMPOSE[@]}" up -d --build
fi

# ─── migrate ────────────────────────────────────────────────────
say "prisma migrate deploy"
run "${COMPOSE[@]}" exec -T api pnpm exec prisma migrate deploy

# ─── seed (optional, idempotent) ────────────────────────────────
if [ "$DO_SEED" -eq 1 ]; then
  say "seed (--seed flag set; idempotent on existing rows)"
  run "${COMPOSE[@]}" exec -T api node dist/scripts/seed.js
fi

# ─── readyz wait ────────────────────────────────────────────────
say "waiting for $API_URL/v1/readyz (timeout 60s)"
ready=0
if [ "$DRY_RUN" -eq 1 ]; then
  ready=1
else
  for i in $(seq 1 30); do
    if curl -fsS -m 2 "$API_URL/v1/readyz" >/dev/null 2>&1; then
      ready=1; break
    fi
    sleep 2
  done
fi
[ "$ready" -eq 1 ] || die "api never became ready — check 'docker compose logs api'"

# Print the actual readyz body so the operator can confirm what
# came back.
if [ "$DRY_RUN" -eq 0 ]; then
  say "readyz response:"
  curl -sS "$API_URL/v1/readyz" | tr -d '\n'
  echo
fi

# ─── deploy log entry ───────────────────────────────────────────
STAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_LINE="$STAMP  branch=$BRANCH  old=$OLD_REV  new=$NEW_REV  seed=$DO_SEED  by=$(id -un)"
if [ "$DRY_RUN" -eq 1 ]; then
  printf '  (dry-run) would append: %s\n' "$LOG_LINE"
else
  # Defensive: create the log file (and its dir) the first time.
  install -m 0644 -D /dev/null "$DEPLOY_LOG" 2>/dev/null || true
  echo "$LOG_LINE" | tee -a "$DEPLOY_LOG" >/dev/null
fi

say "done"
echo "  branch:  $BRANCH"
echo "  rev:     $NEW_REV"
[ "$OLD_REV" != "$NEW_REV" ] && echo "  changes: $(git --no-pager log --oneline "$OLD_REV..$NEW_REV" | wc -l) commit(s)"
echo "  log:     $DEPLOY_LOG"

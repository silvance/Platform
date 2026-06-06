#!/usr/bin/env bash
# Air-gap pack / install helper for the CI Cyber Lab platform (Linux).
#
# Companion to airgap.ps1 (Windows). Same two-mode workflow:
#
#   Pack (on an internet-connected Linux box):
#       ./airgap.sh pack [-o /path/to/bundle]
#     Downloads the Node tarball, runs `pnpm install` + a full
#     production build, and writes a self-contained bundle to -o
#     (default: <parent-of-repo>/ci-cyber-lab-bundle).
#
#   Install (on the air-gapped Linux target, as a sudoer):
#       ./airgap.sh install -s /bundle/path -t /opt/ci-cyber-lab [--seed]
#     Extracts Node into /opt, copies the repo into -t, prompts
#     for DATABASE_URL, runs `prisma migrate deploy`, optionally
#     seeds.
#
# Postgres is intentionally NOT bundled -- distro packages vary
# too much (apt vs dnf vs rpm vs snap) and the operator's install
# media usually has the right version anyway. Install Postgres
# on the target before running install mode.

set -euo pipefail

# --- helpers -------------------------------------------------
stage()  { printf '\n\033[36m==> %s\033[0m\n' "$*"; }
note()   { printf '    %s\n' "$*"; }
ok()     { printf '    \033[32m%s\033[0m\n' "$*"; }
warn()   { printf '\033[33mWARN:\033[0m %s\n' "$*" >&2; }
fail()   { printf '\033[31mERR:\033[0m %s\n' "$*" >&2; exit 1; }

require_tool() {
    command -v "$1" >/dev/null 2>&1 || fail "$1 not found. $2"
}

usage() {
    cat <<EOF

CI Cyber Lab -- air-gap pack / install helper (Linux)
====================================================

Usage:
    ./airgap.sh pack [-o /path/to/bundle]
        On the online Linux box. Default -o is
        <parent-of-repo>/ci-cyber-lab-bundle.

    ./airgap.sh install -s /path/to/bundle -t /install/path [--seed] [--skip-node] [--skip-postgres-check]
        On the air-gapped Linux box (run with sudo).

    ./airgap.sh help
        This message.

Full walkthrough + troubleshooting: AIRGAP-INSTALL-LINUX.txt
(next to this script; also copied into the bundle as INSTALL.txt).

EOF
}

# --- default tuning ------------------------------------------
NODE_TARBALL="node-v20.18.0-linux-x64.tar.xz"
NODE_URL_DEFAULT="https://nodejs.org/dist/v20.18.0/${NODE_TARBALL}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- PACK ----------------------------------------------------
do_pack() {
    [ -f "${REPO_ROOT}/package.json" ] || \
        fail "Run from the repo root (no package.json next to airgap.sh)."

    require_tool curl "Install curl (apt: 'apt install curl', dnf: 'dnf install curl')."
    require_tool tar  "Install tar (almost always preinstalled)."
    require_tool node "Install Node.js >= 20.11 (https://nodejs.org)."
    require_tool npm  "npm ships with Node. If missing, reinstall Node."

    OUTPUT="${OUTPUT:-$(dirname "${REPO_ROOT}")/ci-cyber-lab-bundle}"
    INSTALLERS="${OUTPUT}/installers"
    BUNDLE_REPO="${OUTPUT}/repo"

    stage "Preparing bundle root at ${OUTPUT}"
    mkdir -p "${INSTALLERS}"

    stage "Downloading Node.js tarball"
    note "${NODE_URL_DEFAULT}"
    curl -fSL "${NODE_URL_DEFAULT}" -o "${INSTALLERS}/${NODE_TARBALL}"
    SIZE_MB=$(du -m "${INSTALLERS}/${NODE_TARBALL}" | cut -f1)
    ok "Saved ${INSTALLERS}/${NODE_TARBALL} (${SIZE_MB} MB)"

    stage "Refreshing repo dependencies (pnpm install + Prisma generate)"
    cd "${REPO_ROOT}"

    # Wipe any half-finished node_modules state from a prior run.
    for nm in \
        "${REPO_ROOT}/node_modules" \
        "${REPO_ROOT}/apps/api/node_modules" \
        "${REPO_ROOT}/apps/web/node_modules" \
        "${REPO_ROOT}/packages/contracts/node_modules"; do
        if [ -d "${nm}" ]; then
            note "Removing ${nm} (clean slate for pnpm install)"
            rm -rf "${nm}"
        fi
    done

    if ! command -v pnpm >/dev/null 2>&1; then
        note "pnpm not found -- installing via 'npm install -g pnpm@9.12.0'"
        npm install -g pnpm@9.12.0
    fi
    note "pnpm at $(command -v pnpm)"

    # node-linker=hoisted: install in flat node_modules layout (npm-style),
    # not pnpm's default .pnpm/ virtual store with symlinks. This is the
    # form that survives a file-copy / robocopy intact -- pnpm's default
    # layout uses symlinks for transitive-dep resolution, which break
    # after dereferencing during the bundle copy and lead to
    # "Cannot find module '@prisma/engines'" at runtime on the target.
    pnpm install --frozen-lockfile --config.node-linker=hoisted
    pnpm --filter "@ci-train/contracts" build
    pnpm --filter "@ci-train/api" prisma:generate
    pnpm --filter "@ci-train/api" build
    # Linux supports symlinks natively, so Next.js's `output:
    # "standalone"` build step works fine -- no need for the
    # standalone-disable hack the Windows script needs.
    pnpm --filter "@ci-train/web" build
    ok "Dependencies + builds ready."

    stage "Copying repo into bundle"
    # rsync preserves symlinks (pnpm needs them) and excludes
    # state the bundle doesn't need.
    rsync -a \
        --exclude='.git' \
        --exclude='.env' \
        --exclude='.env.local' \
        --exclude='.env.production' \
        --exclude='.next/cache' \
        --exclude='deploy' \
        --exclude='.turbo' \
        "${REPO_ROOT}/" "${BUNDLE_REPO}/"
    ok "Repo copied to ${BUNDLE_REPO}"

    stage "Writing manifest + INSTALL.txt"
    GIT_REMOTE=$(git -C "${REPO_ROOT}" config --get remote.origin.url 2>/dev/null || echo "")
    GIT_BRANCH=$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    GIT_COMMIT=$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || echo "")
    PACKED_AT=$(date -u +%FT%TZ)
    cat > "${OUTPUT}/manifest.json" <<EOF
{
  "bundle_version": "1",
  "platform": "linux-x64",
  "packed_at_utc": "${PACKED_AT}",
  "node_tarball_url": "${NODE_URL_DEFAULT}",
  "repo_remote": "${GIT_REMOTE}",
  "repo_branch": "${GIT_BRANCH}",
  "repo_commit": "${GIT_COMMIT}"
}
EOF
    if [ -f "${REPO_ROOT}/AIRGAP-INSTALL-LINUX.txt" ]; then
        cp "${REPO_ROOT}/AIRGAP-INSTALL-LINUX.txt" "${OUTPUT}/INSTALL.txt"
    else
        note "AIRGAP-INSTALL-LINUX.txt not found; bundle will not include operator instructions."
    fi

    stage "Bundle complete"
    ok "Bundle: ${OUTPUT}"
    ok "Carry to the air-gapped Linux box, then run:"
    note "    sudo ./airgap.sh install -s <bundle-path> -t /opt/ci-cyber-lab --seed"
}

# --- INSTALL -------------------------------------------------
do_install() {
    [ -n "${SOURCE:-}" ] || fail "install needs -s /path/to/bundle."
    [ -n "${TARGET:-}" ] || fail "install needs -t /install/path."
    [ -f "${SOURCE}/manifest.json" ] || \
        fail "manifest.json not found under ${SOURCE} -- is this the right bundle?"
    [ "$(id -u)" -eq 0 ] || \
        fail "install needs root (sudo) for /opt + DB setup."

    if [ -z "${SKIP_NODE:-}" ]; then
        stage "Installing Node.js into /opt"
        NODE_ARCHIVE=$(ls "${SOURCE}/installers/"node-*-linux-x64.tar.* 2>/dev/null | head -1)
        [ -n "${NODE_ARCHIVE}" ] || fail "No Node tarball under ${SOURCE}/installers/"
        tar -xf "${NODE_ARCHIVE}" -C /opt/
        NODE_DIR=$(ls -d /opt/node-v*-linux-x64 | tail -1)
        for bin in node npm npx; do
            ln -sf "${NODE_DIR}/bin/${bin}" "/usr/local/bin/${bin}"
        done
        ok "Node at ${NODE_DIR} (linked into /usr/local/bin)"
    else
        note "Skipping Node install per --skip-node."
    fi

    if [ -z "${SKIP_POSTGRES_CHECK:-}" ]; then
        if ! command -v psql >/dev/null 2>&1; then
            fail "psql not found. Install postgresql-client (and a server) before re-running, or pass --skip-postgres-check if you know what you're doing."
        fi
        ok "Found psql at $(command -v psql)"
    fi

    stage "Copying repo into ${TARGET}"
    # Skip the rsync if THIS bundle was already applied. Stamp the
    # bundle's manifest hash into the target as .airgap-installed-from
    # on success; the next install re-reads and re-copies only when
    # the bundle changes (e.g. fresh re-pack). --force-repo-copy
    # overrides.
    BUNDLE_STAMP=""
    if [ -f "${SOURCE}/manifest.json" ]; then
        BUNDLE_STAMP=$(sha256sum "${SOURCE}/manifest.json" | awk '{print $1}')
    fi
    INSTALLED_STAMP_FILE="${TARGET}/.airgap-installed-from"
    INSTALLED_STAMP=""
    if [ -f "${INSTALLED_STAMP_FILE}" ]; then
        INSTALLED_STAMP=$(cat "${INSTALLED_STAMP_FILE}" 2>/dev/null | tr -d '[:space:]')
    fi
    if [ -z "${FORCE_REPO_COPY:-}" ] && \
       [ -n "${BUNDLE_STAMP}" ] && [ "${BUNDLE_STAMP}" = "${INSTALLED_STAMP}" ] && \
       [ -f "${TARGET}/apps/api/dist/main.js" ] && \
       [ -d "${TARGET}/apps/web/.next" ]; then
        ok "Same bundle already installed at ${TARGET} (skipping; --force-repo-copy to override)."
    else
        if [ -z "${FORCE_REPO_COPY:-}" ] && [ -f "${TARGET}/apps/api/dist/main.js" ]; then
            note "Target has a different bundle installed -- re-copying."
        fi
        mkdir -p "${TARGET}"
        rsync -a "${SOURCE}/repo/" "${TARGET}/"
        if [ -n "${BUNDLE_STAMP}" ]; then
            echo "${BUNDLE_STAMP}" > "${INSTALLED_STAMP_FILE}"
        fi
        ok "Repo at ${TARGET}"
    fi

    stage "DATABASE_URL configuration"
    ENVFILE="${TARGET}/apps/api/.env"
    if [ -f "${ENVFILE}" ]; then
        note "${ENVFILE} already exists. Edit by hand if it needs changing."
    else
        printf "Paste the DATABASE_URL (e.g. postgresql://postgres:PASSWORD@localhost:5432/ci_cyber_lab): "
        read -r DB_URL
        [ -n "${DB_URL}" ] || fail "DATABASE_URL is required."
        echo "DATABASE_URL=${DB_URL}" > "${ENVFILE}"
        ok "Wrote ${ENVFILE}"
    fi

    stage "Applying Prisma migrations"
    # Use Node's own resolution to find the prisma CLI -- pnpm
    # hoisted mode in a workspace hoists workspace dev deps to the
    # workspace root, so apps/api/node_modules/prisma may not exist
    # but ${TARGET}/node_modules/prisma does.
    PRISMA_CLI=$(cd "${TARGET}/apps/api" && /usr/local/bin/node -e \
        "try{console.log(require.resolve('prisma/build/index.js'))}catch(e){process.exit(2)}" 2>/dev/null) \
        || fail "Could not resolve 'prisma/build/index.js' from ${TARGET}/apps/api. Did pnpm install run during pack?"
    (cd "${TARGET}/apps/api" && \
     /usr/local/bin/node "${PRISMA_CLI}" migrate deploy)
    ok "Migrations applied."

    if [ -n "${SEED:-}" ]; then
        stage "Seeding content"
        # --env-file: Node 20.6+ loads .env before running the
        # script. Prisma's CLI handles this on its own for
        # migrate; a plain `node seed.js` does not.
        (cd "${TARGET}/apps/api" && /usr/local/bin/node --env-file=.env "dist/scripts/seed.js")
        ok "Seed complete."
    else
        note "Skipping seed. Re-run with --seed to populate the catalog."
    fi

    # Resolve next's bin so the printed command points where next
    # actually lives -- pnpm hoisted mode in a workspace hoists
    # `next` to the workspace root, not apps/web/node_modules.
    NEXT_BIN=$(cd "${TARGET}/apps/web" && /usr/local/bin/node -e \
        "try{console.log(require.resolve('next/dist/bin/next'))}catch(e){process.exit(2)}" 2>/dev/null) || \
        NEXT_BIN="<could not resolve 'next' bin -- check ${TARGET}/node_modules/next>"

    stage "Done"
    cat <<EOF

The platform is installed at ${TARGET}.

To start the API (port 4000):
    cd ${TARGET}/apps/api && node dist/main.js

To start the web app (port 3000):
    cd ${TARGET}/apps/web && node ${NEXT_BIN} start -p 3000

See AIRGAP-INSTALL-LINUX.txt (next to this script; also at the
bundle root) for how to run these as systemd services, set the
admin password, and verify the install.

EOF
}

# --- argument parsing ----------------------------------------
MODE="${1:-}"
[ -n "${MODE}" ] || { usage; exit 1; }
shift || true

case "${MODE}" in
    pack)
        while [ $# -gt 0 ]; do
            case "$1" in
                -o|--output) OUTPUT="$2"; shift 2 ;;
                -h|--help)   usage; exit 0 ;;
                *) fail "Unknown pack arg: $1 (run './airgap.sh help' for usage)" ;;
            esac
        done
        do_pack
        ;;
    install)
        SEED=""
        SKIP_NODE=""
        SKIP_POSTGRES_CHECK=""
        FORCE_REPO_COPY=""
        while [ $# -gt 0 ]; do
            case "$1" in
                -s|--source) SOURCE="$2"; shift 2 ;;
                -t|--target) TARGET="$2"; shift 2 ;;
                --seed) SEED="1"; shift ;;
                --skip-node) SKIP_NODE="1"; shift ;;
                --skip-postgres-check) SKIP_POSTGRES_CHECK="1"; shift ;;
                --force-repo-copy) FORCE_REPO_COPY="1"; shift ;;
                -h|--help) usage; exit 0 ;;
                *) fail "Unknown install arg: $1 (run './airgap.sh help' for usage)" ;;
            esac
        done
        do_install
        ;;
    help|-h|--help)
        usage
        ;;
    *)
        usage
        fail "Unknown mode: ${MODE}"
        ;;
esac

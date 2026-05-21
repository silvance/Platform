# syntax=docker/dockerfile:1.7

# ─── base ──────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ─── build ─────────────────────────────────────────────────────
# Deterministic install via the committed lockfile, then build, then
# emit a self-contained deploy directory for the api package only.
FROM base AS build

# Manifests first so the deps layer caches.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Source for the api and its workspace dep.
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api

RUN pnpm --filter @ci-train/contracts build \
 && pnpm --filter @ci-train/api build \
 && pnpm --filter @ci-train/api deploy --prod /deploy/api

# ─── runtime ───────────────────────────────────────────────────
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Wget is used by the compose healthcheck.
RUN apk add --no-cache wget

COPY --from=build /deploy/api ./

EXPOSE 4000
CMD ["node", "dist/main.js"]

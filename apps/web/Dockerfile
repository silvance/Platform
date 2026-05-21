# syntax=docker/dockerfile:1.7

# ─── base ──────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ─── build ─────────────────────────────────────────────────────
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1

# Manifests first for layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Source for the web app and its workspace dep.
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web

RUN pnpm --filter @ci-train/contracts build \
 && pnpm --filter @ci-train/web build

# ─── runtime ───────────────────────────────────────────────────
# Next.js standalone output already bundles the resolved server +
# its production dependencies, so no install is required at runtime.
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN apk add --no-cache wget

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node", "server.js"]

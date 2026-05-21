# syntax=docker/dockerfile:1.7

# ─── base ──────────────────────────────────────────────────────
FROM node:20-alpine AS base
# Prisma needs openssl on Alpine for its query engine. libc6-compat keeps
# glibc-style binaries (sharp, etc.) working when they appear.
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ─── build ─────────────────────────────────────────────────────
FROM base AS build

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api

RUN pnpm --filter @ci-train/contracts build \
 && pnpm --filter @ci-train/api exec prisma generate \
 && pnpm --filter @ci-train/api build \
 && pnpm --filter @ci-train/api deploy --prod /deploy/api

# ─── runtime ───────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache wget

COPY --from=build /deploy/api ./
# The deploy output places prisma/ at the package root; keep it for
# `prisma migrate deploy` at container start.

COPY apps/api/scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]

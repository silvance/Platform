# syntax=docker/dockerfile:1.7

# ─── deps stage ────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false

# ─── build stage ───────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules

COPY tsconfig.base.json package.json pnpm-workspace.yaml ./
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web

RUN pnpm --filter @ci-train/contracts build
RUN pnpm --filter @ci-train/web build

# ─── runtime stage ─────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js standalone output bundles only what's needed.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node", "server.js"]

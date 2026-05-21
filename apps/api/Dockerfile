# syntax=docker/dockerfile:1.7

# ─── deps stage ────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false

# ─── build stage ───────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules

COPY tsconfig.base.json package.json pnpm-workspace.yaml ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api

RUN pnpm --filter @ci-train/contracts build
RUN pnpm --filter @ci-train/api build

# ─── runtime stage ─────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/tsconfig.base.json ./
COPY --from=build /repo/packages/contracts ./packages/contracts
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile=false

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]

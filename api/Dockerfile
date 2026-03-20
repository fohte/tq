# syntax=docker/dockerfile:1

FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

# Local development stage (used by docker compose)
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/api/node_modules ./api/node_modules
COPY . .
WORKDIR /app/api
CMD ["pnpm", "dev"]

# Build stage
FROM deps AS builder
COPY . .
RUN pnpm --filter api build

# Production runtime
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/api/dist ./api/dist
EXPOSE 3001
WORKDIR /app/api
CMD ["node", "dist/index.js"]

LABEL org.opencontainers.image.source=https://github.com/fohte/tq

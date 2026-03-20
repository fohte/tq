# syntax=docker/dockerfile:1

# -- Base stage --
FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

# -- Dependencies stage --
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

# -- Build frontend --
FROM deps AS web-build
COPY api/ api/
COPY web/ web/
RUN pnpm --filter web build

# -- Production stage --
FROM base AS production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

COPY api/ api/
COPY --from=web-build /app/web/dist/ api/public/
COPY docker-entrypoint.sh .

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]

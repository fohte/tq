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

# -- Production stage --
FROM deps AS production

COPY api/ api/

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["pnpm", "--filter", "api", "start"]

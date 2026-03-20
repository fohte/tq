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

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/api/node_modules ./api/node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY . .
RUN pnpm --filter web build

# Production runtime: serve static files with nginx
FROM nginx:stable-alpine AS runtime
COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

LABEL org.opencontainers.image.source=https://github.com/fohte/tq

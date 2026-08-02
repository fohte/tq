# syntax=docker/dockerfile:1

<<<<<<< before updating
FROM node:24-slim AS base
||||||| last update
=======
# Keep the Node.js version in sync with .mise.toml.
FROM node:24.18.0-slim AS base
>>>>>>> after updating
WORKDIR /app
<<<<<<< before updating
COPY package.json ./
RUN corepack enable && corepack prepare --activate
||||||| last update
=======
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Node.js 25+ no longer bundles Corepack: https://github.com/nodejs/corepack
RUN npm install -g corepack@0.35.0 && npm cache clean --force && corepack enable
>>>>>>> after updating

<<<<<<< before updating
# Install dependencies
||||||| last update
=======
>>>>>>> after updating
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
<<<<<<< before updating
COPY api/package.json api/
||||||| last update
=======
>>>>>>> after updating
COPY web/package.json web/
<<<<<<< before updating
RUN pnpm install --frozen-lockfile
||||||| last update
=======
COPY api/package.json api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
>>>>>>> after updating

<<<<<<< before updating
# Local development stage (used by docker compose)
||||||| last update
=======
# Local development stage. Bind-mount the repo over /app (e.g. from
# docker compose, with an anonymous volume on /app/node_modules to keep
# this image's install instead of the host's) for live-reload without
# rebuilding the image.
>>>>>>> after updating
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/api/node_modules ./api/node_modules
<<<<<<< before updating
COPY . .
||||||| last update
=======
>>>>>>> after updating
WORKDIR /app/api
CMD ["pnpm", "dev"]

<<<<<<< before updating
# Build stage
||||||| last update
=======
>>>>>>> after updating
FROM deps AS builder
COPY . .
RUN pnpm --filter api build

<<<<<<< before updating
# Production runtime
||||||| last update
=======
# Built fresh from `base`, not `builder`, so the runtime image doesn't inherit
# dev dependencies or source files left over from the build stage.
>>>>>>> after updating
FROM base AS runtime
ENV NODE_ENV=production
<<<<<<< before updating
ENV APP_ENV=production
||||||| last update
=======
>>>>>>> after updating
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
<<<<<<< before updating
COPY api/package.json api/
||||||| last update
=======
>>>>>>> after updating
COPY web/package.json web/
<<<<<<< before updating
RUN pnpm install --frozen-lockfile --prod
||||||| last update
=======
COPY api/package.json api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod
>>>>>>> after updating
COPY --from=builder /app/api/dist ./api/dist
<<<<<<< before updating
COPY api/drizzle ./api/drizzle
COPY api/otel-register.mjs ./api/
EXPOSE 3001
||||||| last update
=======
USER node
>>>>>>> after updating
WORKDIR /app/api
<<<<<<< before updating
CMD ["node", "--import", "./otel-register.mjs", "dist/index.js"]

LABEL org.opencontainers.image.source=https://github.com/fohte/tq
||||||| last update
=======
EXPOSE 8080
CMD ["node", "--import", "@fohte/service-kit/otel-register", "dist/index.js"]
>>>>>>> after updating

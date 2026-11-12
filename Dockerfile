# syntax=docker/dockerfile:1
# FiskART: the editor and its API in one Node image. Postgres runs next to it (docker-compose.yml).

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# Dependencies, cached until the lockfile changes. The Prisma client is generated on install, so
# the schema comes first.
FROM base AS deps
# prisma.config.ts insists on a database URL; generating the client and building never connect.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# The background removal model and runtime are served by the app itself (about 96 MB).
RUN pnpm bg-removal:fetch
RUN pnpm build
# Runtime needs only production dependencies (prisma and tsx are among them: migrations and the
# template seed run when the container starts).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm prune --prod --ignore-scripts

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DATA_DIR=/data
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
COPY --from=build --chown=node:node /app/package.json /app/next.config.mjs /app/prisma.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/docker/entrypoint.sh ./docker/entrypoint.sh
USER node
VOLUME ["/data"]
EXPOSE 3000
ENTRYPOINT ["sh", "docker/entrypoint.sh"]

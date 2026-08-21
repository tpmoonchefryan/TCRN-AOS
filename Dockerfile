# Three stages: install, build, run.
#
# The build never reaches the network for dependencies — everything resolves from the
# lockfile and from vendor/*.tgz, which is what makes this a sealed build and what the
# `file:../TCRN-Design-System` sibling dependency made impossible before.

# The minor version is pinned, and the runtime asserts it. "Node 24" is not a version; it
# is a range, and a range is how a build starts behaving differently without anyone
# changing anything.
FROM node:24.16-bookworm-slim AS deps
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY vendor ./vendor
RUN pnpm install --frozen-lockfile --prefer-offline

FROM deps AS build
WORKDIR /app
COPY tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
RUN node scripts/codegen-migrations.mjs \
 && ./node_modules/.bin/tsc -p tsconfig.json

FROM node:24.16-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY vendor ./vendor
RUN pnpm install --frozen-lockfile --prefer-offline --prod \
 && pnpm store prune || true

COPY --from=build /app/dist ./dist
COPY --from=build /app/apps/server/assets ./apps/server/assets

RUN chown -R 10001:10001 /app

USER 10001:10001
EXPOSE 8080
ENV AOS_BIND_HOST=0.0.0.0
ENV AOS_PORT=8080

# No shell form: the process must receive SIGTERM directly, or a rolling restart waits for
# the grace period every single time.
CMD ["node", "dist/apps/server/src/main.js"]

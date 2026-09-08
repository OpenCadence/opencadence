# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN corepack enable pnpm

FROM base AS dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
RUN mkdir -p /dependency-licenses && \
    find node_modules -type f \
      \( -iname 'LICENSE*' -o -iname 'COPYING*' -o -iname 'NOTICE*' \) \
      -exec cp --parents '{}' /dependency-licenses/ \;

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1 \
    CADENCE_STANDALONE=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runner
ARG SOURCE_REVISION=unreleased
LABEL org.opencontainers.image.source="https://github.com/OpenCadence/opencadence" \
      org.opencontainers.image.revision="$SOURCE_REVISION" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/cadence.sqlite
RUN install -d -m 0700 -o node -g node /app/data
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/scripts/backup.mjs ./scripts/backup.mjs
COPY --from=dependencies --chown=node:node /app/node_modules/@next/env ./node_modules/@next/env
# OpenCadence serves static brand assets and does not use Next Image Optimization.
# Remove its unused native Sharp/libvips closure from the distributable image.
RUN rm -rf node_modules/sharp node_modules/@img \
    node_modules/.pnpm/sharp@* node_modules/.pnpm/@img+sharp*
COPY --from=builder --chown=node:node /app/LICENSE /app/NOTICE /app/THIRD_PARTY_NOTICES.md ./
COPY --from=dependencies --chown=node:node /dependency-licenses /usr/share/licenses/opencadence-dependencies
# Accompany the runnable build with the exact source and build inputs used for it.
COPY --chown=node:node . /usr/src/opencadence
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/revision').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]

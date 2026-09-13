# Build and run apps/app — the operator ZONE behind web, not a public origin.
#
# Built from the repository root so the workspace packages it depends on
# (@injishi/ui, /utils, /contracts, /auth, /design-tokens) are present:
#   docker build -f infra/docker/Dockerfile.app -t injishi-app .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- dependencies ----------------------------------------------------------
# Manifests are copied on their own so a source-only change does not bust the
# install layer. Every workspace member that exists is listed: pnpm-workspace.yaml
# globs apps/*, server/*, packages/*, and a frozen install fails if any
# member's package.json is missing. Do not copy turbo.json or packages/config;
# neither exists in this repo.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/app/package.json ./apps/app/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
COPY apps/mobile/package.json ./apps/mobile/
COPY server/api/package.json ./server/api/
COPY packages/auth/package.json ./packages/auth/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/qr/package.json ./packages/qr/
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/ui/package.json ./packages/ui/
COPY packages/ui-contract/package.json ./packages/ui-contract/
COPY packages/utils/package.json ./packages/utils/
RUN pnpm install --frozen-lockfile

# ---- build -----------------------------------------------------------------
FROM base AS build
# Copy the complete dependency tree, including each workspace's package-local
# pnpm links. Shared source packages resolve their own ESLint plugins, React
# types, and runtime dependencies through these directories during `next build`.
COPY --from=deps /repo ./
COPY . .
# Standalone output is opt-in; see the note in apps/app/next.config.ts.
# OPERATOR_ASSET_PREFIX is baked into the client chunks at build time.
# NEXT_PUBLIC_PMS_URL is the public web origin: this process is a zone under
# web, so absolute "self" links must not name a second public host.
ARG OPERATOR_ASSET_PREFIX=/operator-static
ARG NEXT_PUBLIC_API_URL=https://api.injishi.com
ARG NEXT_PUBLIC_WEB_URL=https://www.injishi.com
ARG NEXT_PUBLIC_PMS_URL=https://www.injishi.com
# `demo` for the demo stack's image and nothing else (ADR-043, AC-14): the
# middleware's strip of production's session cookies. Empty means production.
ARG NEXT_PUBLIC_INJISHI_ENVIRONMENT=
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1 \
    NEXT_PUBLIC_INJISHI_ENVIRONMENT=$NEXT_PUBLIC_INJISHI_ENVIRONMENT \
    OPERATOR_ASSET_PREFIX=$OPERATOR_ASSET_PREFIX \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL \
    NEXT_PUBLIC_PMS_URL=$NEXT_PUBLIC_PMS_URL
RUN pnpm --filter @injishi/app build

# ---- run -------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3002 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build --chown=nextjs:nodejs /repo/apps/app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/app/.next/static ./apps/app/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/app/public ./apps/app/public

USER nextjs
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3002/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/app/server.js"]

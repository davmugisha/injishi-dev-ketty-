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
# globs apps/*, products/*, server/*, packages/*, and a frozen install fails if any
# member's package.json is missing. Do not copy turbo.json or packages/config;
# neither exists in this repo.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/app/package.json ./apps/app/
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/
COPY server/api/package.json ./server/api/
COPY server/mock-apis/package.json ./server/mock-apis/
COPY packages/auth/package.json ./packages/auth/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/qr/package.json ./packages/qr/
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/ui/package.json ./packages/ui/
# Full `pnpm install` below needs every workspace member the lockfile names.
# apps/web (copied above) aliases @injishi/ui to web-ui; ui-contract is its peer.
COPY packages/web-ui/package.json ./packages/web-ui/
COPY packages/ui-contract/package.json ./packages/ui-contract/
COPY packages/data/package.json ./packages/data/
COPY packages/db/package.json ./packages/db/
COPY packages/utils/package.json ./packages/utils/
# ADR-074. products/* is globbed too; each product adds its own line here, in
# all three Dockerfiles, in the change that creates it. A build stage needs the
# product source only where its app mounts the product: Dockerfile.app copies the
# whole tree; web and api add `COPY products ./products` when they first do.
COPY packages/product-contract/package.json ./packages/product-contract/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/i18n/package.json ./packages/i18n/
COPY products/hr/package.json ./products/hr/
COPY products/outlets/package.json ./products/outlets/
COPY products/pms/package.json ./products/pms/
# HeroUI Pro (a paid licence) ships a stub on npm; its postinstall downloads
# the real code with HEROUI_AUTH_TOKEN, the team's CI/CD token (never a
# personal one). It arrives as a BuildKit secret, so it is never written into
# a layer; compose passes it from the stack's .env (`secrets: heroui_token`).
# An empty one stops the build HERE, not at `next build`: Docker's layer cache
# never sees a secret's value, so an install that ran without it would be
# reused, Pro-less, by every later build until the lockfile changed.
RUN --mount=type=secret,id=heroui_token \
    export HEROUI_AUTH_TOKEN="$(cat /run/secrets/heroui_token 2>/dev/null)"; \
    [ -n "$HEROUI_AUTH_TOKEN" ] || { echo "HEROUI_AUTH_TOKEN is empty: set it in this stack's .env (DOKPLOY.md, Required secrets with no default)" >&2; exit 1; }; \
    pnpm install --frozen-lockfile

# ---- build -----------------------------------------------------------------
FROM base AS build
# Copy the complete dependency tree, including each workspace's package-local
# pnpm links. Shared source packages resolve their own ESLint plugins, React
# types, and runtime dependencies through these directories during `next build`.
COPY --from=deps /repo ./
COPY . .
# Standalone output is opt-in; see the note in apps/app/next.config.ts.
# OPERATOR_ASSET_PREFIX is baked into the client chunks at build time.
# NEXT_PUBLIC_PMS_URL is this app's own public origin (app.injishi.com;
# http://localhost:3002 locally): web hands sign-in to it.
ARG OPERATOR_ASSET_PREFIX=/operator-static
# The public origins have NO default: a default of production's origins let a
# staging or demo build that forgot one ship an app calling production. Each
# compose file passes all three; the RUN below refuses a build missing one.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_PMS_URL
# `demo` for the demo stack's image and nothing else (ADR-043, AC-14): the
# proxy's strip of production's session cookies. Empty means production.
ARG NEXT_PUBLIC_INJISHI_ENVIRONMENT=
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1 \
    NEXT_PUBLIC_INJISHI_ENVIRONMENT=$NEXT_PUBLIC_INJISHI_ENVIRONMENT \
    OPERATOR_ASSET_PREFIX=$OPERATOR_ASSET_PREFIX \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL \
    NEXT_PUBLIC_PMS_URL=$NEXT_PUBLIC_PMS_URL
RUN : "${NEXT_PUBLIC_API_URL:?build arg NEXT_PUBLIC_API_URL is required (API public origin)}" \
 && : "${NEXT_PUBLIC_WEB_URL:?build arg NEXT_PUBLIC_WEB_URL is required (web public origin)}" \
 && : "${NEXT_PUBLIC_PMS_URL:?build arg NEXT_PUBLIC_PMS_URL is required (this app's own public origin)}"
RUN pnpm --filter @injishi/app build

# ---- run -------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3002 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# The embedded fixture database (@injishi/db) when INJISHI_DB_URL names
# file:/data/…; a named volume mounted here inherits this owner on first use.
RUN mkdir -p /data && chown nextjs:nodejs /data

COPY --from=build --chown=nextjs:nodejs /repo/apps/app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/app/.next/static ./apps/app/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/app/public ./apps/app/public

USER nextjs
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3002/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/app/server.js"]

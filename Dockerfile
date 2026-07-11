# -- deps: install all workspace dependencies --
FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile

# -- builder: compile all packages --
FROM deps AS builder
# Vite only exposes VITE_-prefixed vars to import.meta.env, and only at build
# time — set before the web build specifically, not globally, so it doesn't
# leak into the api/shared build steps that don't need it.
ARG VITE_APP_VERSION=dev
COPY . .
RUN pnpm --filter @staffcomplete/shared build && \
    VITE_APP_VERSION=$VITE_APP_VERSION pnpm --filter @staffcomplete/web build && \
    pnpm --filter @staffcomplete/api build

# -- prod-deps: production-only node_modules for the api (no symlinks) --
FROM builder AS prod-deps
RUN pnpm deploy --filter @staffcomplete/api --prod --legacy /prod

# -- runner: minimal production image --
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /prod/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
# Vue SPA static files — served by the API at runtime
COPY --from=builder /app/apps/web/dist ./public

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]

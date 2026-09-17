# Production image for the API and the worker. They share everything but the
# command, so they share an image.
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @pasen/shared build
RUN pnpm --filter @pasen/api exec node ace build

FROM base AS runtime
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Production dependencies only, installed against the workspace so the compiled
# build output below still resolves @pasen/shared through the usual link.
RUN pnpm install --frozen-lockfile --prod --filter @pasen/api... \
  && pnpm store prune

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/build ./apps/api/build

WORKDIR /app/apps/api/build
EXPOSE 3333
CMD ["node", "bin/server.js"]

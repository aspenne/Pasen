# The web app is static once built; Caddy serves it in production.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @pasen/shared build

# Vite inlines env vars at build time, so the API origin is a build argument
# rather than a runtime one.
ARG VITE_API_URL
ARG VITE_DEFAULT_GROUP
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEFAULT_GROUP=$VITE_DEFAULT_GROUP
RUN pnpm --filter @pasen/web exec vite build

FROM caddy:2-alpine AS runtime
COPY --from=build /app/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile

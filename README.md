# Pasen

League of Legends stats for a group of friends. First group: **ARIGAFION**, at `/arigafion`.

Where dpm.lol and op.gg are built around one player, Pasen is built around a roster:
today's games for everyone at a glance, who is in a game right now and against
whom, duo synergies, internal leaderboards, and a shared champion pool.

## Stack

| Layer | Choice |
|---|---|
| API | AdonisJS 6 (Lucid, Vine, session auth) |
| Worker | Same codebase, separate process (`node ace worker:run`), BullMQ |
| Database | PostgreSQL 16 — raw match payloads in `jsonb`, queried with GIN |
| Cache / queues | Redis 7 |
| Web | Vite + React 19 + TanStack Router & Query + Tailwind 4 |
| Charts | Apache ECharts |
| Dev / deploy | Docker Compose |

Node is pinned in `.nvmrc` (24.21.0). AdonisJS 6 requires Node >= 24.

## Getting started

```bash
nvm use
cp .env.example .env     # then set APP_KEY
pnpm install
docker compose up
```

- API: http://localhost:3333 (`/health` reports Postgres and Redis)
- Web: http://localhost:5173

Prefer running the apps natively against the containerised datastores? Start only
`postgres` and `redis` with compose, then `pnpm dev:api`, `pnpm dev:web`,
`pnpm dev:worker`.

### After changing dependencies

`node_modules` lives on named Docker volumes so the Linux-built binaries in the
image are not shadowed by the host's macOS ones. A plain `docker compose down`
keeps those volumes, so a lockfile change will not be picked up:

```bash
pnpm dev:reset
```

## Riot API key

Development keys expire every 24 hours. The `settings` table is the source of
truth so the key can be rotated from `/admin` without a redeploy; `RIOT_API_KEY`
in `.env` is only the bootstrap value.

Rate limits for a development or personal key are 20 requests/second and
100 requests/2 minutes, shared across the whole application. Every Riot call goes
through a single gateway with a Redis token bucket — nothing calls Riot directly.

## Layout

```
apps/api          AdonisJS — HTTP server and worker
apps/web          Vite + React SPA
packages/shared   Types and constants used by both (compiled to dist/)
```

`packages/shared` is compiled rather than consumed as raw TypeScript, because the
Adonis build only transpiles its own `app/` directory. Run `pnpm build:shared`
after editing it (the compose stack does this automatically on start).

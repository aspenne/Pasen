# Pasen

League of Legends stats for a group of friends. First group: **ARIGAFION**, at `/arigafion`.

> **Tu cherches juste à installer l'app pour enregistrer vos customs ?**
> Tout est expliqué pas à pas, sans jargon, dans le
> **[guide de Pasen Capture](apps/capture/README.md)** : téléchargement,
> installation sur Windows et Mac, liaison de ton PC, utilisation, et quoi faire
> si quelque chose coince. Le reste de cette page s'adresse aux développeurs.

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
keeps those volumes, so a lockfile change is not picked up on its own.

Cheapest first — installs inside the running containers, touches nothing else:

```bash
pnpm dev:deps
```

If that is not enough, rebuild the images and recreate **only** the module
volumes. The database and Redis survive:

```bash
pnpm dev:reset
```

`pnpm dev:nuke` also drops `pgdata`. That means re-running every backfill, which
is tens of thousands of Riot requests and hours of waiting — so it is a separate
command you have to mean.

## Querying the database

The Postgres container publishes on host port **5433**, not 5432. A Postgres
installed on the host binds 127.0.0.1:5432 specifically, which wins over
Docker's wildcard bind, so pointing a client at 5432 silently reaches the local
server instead.

| | |
|---|---|
| Host | `localhost` |
| Port | `5433` |
| Database | `pasen` (the suite uses `pasen_test`) |
| User / password | `pasen` / `pasen` |

`pasen_test` looks almost empty between runs by design: the suite migrates
before and rolls back after, so only the migration bookkeeping tables persist.

## Running ace commands

Inside the container, which already has the right Node and environment:

```bash
docker compose exec api node ace list
```

Or natively from `apps/api`, after `nvm use` at the repo root — AdonisJS 6
requires Node 24 and ace fails confusingly on an older one:

```bash
cd apps/api && node ace list
```

The project's own commands:

| Command | What it does |
|---|---|
| `pasen:group "ARIGAFION"` | Create a group, or list existing ones |
| `pasen:add <group> "Name#TAG" <platform>` | Link a Riot account, creating the member if needed |
| `pasen:sync [--backfill]` | Pull recent matches, or walk history backwards |
| `riot:key [status\|set\|check]` | Rotate or verify the Riot API key |
| `static:sync [--force]` | Re-import Data Dragon |
| `worker:run` | Run the background worker (what the worker container runs) |

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
apps/capture      Pasen Capture, the Electron desktop app that sends customs
apps/agent        The command-line capture agent it replaced, kept as a fallback
packages/shared   Types and constants used by both (compiled to dist/)
```

`packages/shared` is compiled rather than consumed as raw TypeScript, because the
Adonis build only transpiles its own `app/` directory. Run `pnpm build:shared`
after editing it (the compose stack does this automatically on start).

## Deploying

No platform. A bare git repository on the server has a `post-receive` hook that
checks the branch out and runs `deploy.sh`, so the whole pipeline is:

```bash
git push production main
```

Caddy terminates TLS and serves the site and the API on **one origin** — `/api`
goes to the API, everything else to the SPA. That removes CORS entirely and
keeps the admin session cookie first-party, which is why `VITE_API_URL` is empty
in the production build: the browser calls the host it is already on.

`deploy.sh` builds, brings the datastores up, runs migrations *before* the app
starts serving, then starts everything and waits for `/health`. A request never
meets a half-migrated schema.

### First time on a new server

```bash
ssh root@server 'mkdir -p /srv/pasen.git /srv/pasen && git init --bare /srv/pasen.git'
```

Copy `ops/post-receive` to `/srv/pasen.git/hooks/`, put a filled-in `.env`
(from `.env.prod.example`) in `/srv/pasen`, then add the remote and push:

```bash
git remote add production root@server:/srv/pasen.git && git push production main
```

Afterwards, once:

```bash
ssh root@server 'cd /srv/pasen && docker compose -f docker-compose.prod.yml exec -e ADMIN_PASSWORD=… api node ace admin:create you@example.com'
```

```bash
ssh root@server 'cd /srv/pasen && docker compose -f docker-compose.prod.yml exec api node ace static:sync'
```

Paste the Riot key at `/admin` rather than into the environment: the database is
the source of truth, so a rotation needs no redeploy and no restart.

### Boot and backups

`ops/pasen.service` brings the stack up after a reboot; compose's own restart
policies cover a crashed container. `ops/backup.sh` dumps Postgres nightly and
keeps a fortnight — a full backfill of eleven accounts is tens of thousands of
Riot requests and hours of waiting, so the history is worth far more than the
disk a dump costs.

### A note on the box

A one-vCPU server builds these images slowly and, without swap, can run out of
memory partway through. The server has a 4 GB swapfile and `vm.swappiness=10`
for that reason: a build that would have been killed gets slow instead.

## Commits

[Conventional Commits](https://www.conventionalcommits.org): `type(scope): description`,
imperative mood, lowercase, no trailing period.

Types: `feat` `fix` `refactor` `perf` `test` `docs` `chore` `build` `ci`.

Scopes follow the layout: `riot` `ingestion` `stats` `db` `api` `web` `worker`
`shared` `docker` `repo`.

```
feat(riot): add redis token bucket shared across processes
fix(ingestion): stop backfill cursor rewinding on a partial page
test(riot): cover 429 retry-after handling
```

A change that breaks an existing API or schema adds `!` before the colon and a
`BREAKING CHANGE:` footer.

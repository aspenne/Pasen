# Pasen — plateforme de stats LoL pour groupes d'amis

## Context

Objectif : un site web privé qui agrège les stats League of Legends d'un groupe d'amis (ARIGAFION), accessible sur `pasen.xxx/arigafion`, avec la possibilité d'ajouter d'autres groupes plus tard. Le besoin central : voir en un coup d'œil les games du jour de tout le groupe, qui joue **en ce moment et contre qui**, et explorer des pages joueur riches en graphes (façon dpm.lol) mais orientées **collectif** — synergies de duo, leaderboards internes, pool de champions partagé.

Rien n'existe encore : projet créé de zéro dans `~/Computing/Projects/Pasen`.

### Décisions validées

| Sujet | Choix |
|---|---|
| Produit / groupe | Produit = **Pasen**, premier groupe = **ARIGAFION** (`/arigafion`) |
| Clé Riot | Development Key au départ (rotation quotidienne via admin), demande de **Personal Key** en parallèle |
| Base de données | **PostgreSQL 16** (au lieu de MySQL : `jsonb` + GIN pour stocker le brut et requêter dedans) |
| Backend | **AdonisJS v6** + Lucid + Vine, process HTTP et process worker séparés |
| Front | **Vite + React + TypeScript**, TanStack Query + TanStack Router, Tailwind |
| Graphes | **Apache ECharts** (`echarts-for-react`), thème sombre custom |
| Infra | Docker Compose (dev + prod), **Redis** (cache, rate limiter, BullMQ) |
| Temps réel | Worker qui poll `spectator-v5`, cache Redis, front qui poll un endpoint REST |
| Historique | Backfill **saison/split en cours**, puis incrémental |
| Files | **Toutes** ingérées (Solo, Flex, Normal, ARAM, Arena, Clash), filtrées à l'affichage |
| Timelines | Table + job prévus mais **désactivés en v1** (doublerait le coût API) |
| Modèle joueur | **Membre → N comptes Riot** (smurfs agrégés) |
| Accès | Lecture publique, **admin protégé** (session Adonis) |
| Langue UI | **Anglais** uniquement, pas d'i18n |
| Direction visuelle | **A — esport data** : fond bleu-nuit très sombre, accent doré `#D4AF5A`, chiffres en mono, cartes denses, coins nets, barre d'accent à gauche |
| Déploiement | VPS + Docker Compose + Caddy (HTTPS auto) |

---

## Contraintes Riot qui dictent l'architecture

1. **Rate limit** : Development/Personal Key = **20 req/s et 100 req/2 min**. C'est la ressource rare de tout le système. Tous les appels Riot doivent passer par un **seul point de passage** avec token bucket partagé entre les process.
2. **1 appel par match** pour le détail (`match-v5/matches/{id}`). 100 match IDs max par appel de liste. Un backfill de saison ≈ 300-800 games/joueur ≈ 10-25 min par compte. D'où : queue de fond avec curseur persistant et priorités.
3. **Deux routings différents** : `account-v1` et `match-v5` sur cluster régional (`europe`, `americas`, `asia`, `sea`) ; `summoner-v4`, `league-v4`, `spectator-v5` sur plateforme (`euw1`, `na1`…). La « région » saisie par l'admin est une **plateforme**, le cluster s'en déduit.
4. **Dev key expire toutes les 24 h** → la clé est stockée en base (avec fallback env) et modifiable depuis `/admin` sans redéploiement.
5. **ToS** (mars 2025) : pas de timers d'ults ennemis, pas d'aide au dodge en champ select, pas de lecture mémoire. Un écran « live games » façon Porofessor reste autorisé.

---

## Architecture

```
pasen/                         (pnpm workspace, git)
├── docker-compose.yml         dev : postgres, redis, api, worker, web
├── docker-compose.prod.yml    prod : + caddy, builds multi-stage
├── .env.example
├── apps/
│   ├── api/                   AdonisJS v6 — HTTP + worker (même image, 2 commandes)
│   └── web/                   Vite + React + TS
└── packages/
    └── shared/                types DTO partagés api ↔ web
```

Trois process en prod : `api` (HTTP), `worker` (BullMQ + scheduler), `web` (statique via Caddy).

### Backend — découpage par responsabilité

```
apps/api/app/
├── riot/                      ← accès Riot, seul module qui parle à l'extérieur
│   ├── riot_gateway.ts        point de passage unique : bucket Redis + retry + 429/503
│   ├── rate_limiter.ts        token bucket Redis (app-level + method-level)
│   ├── routing.ts             platform → regional cluster
│   ├── key_provider.ts        clé depuis DB (cache Redis), fallback env
│   └── endpoints/             account, summoner, league, match, spectator
├── static_data/
│   └── ddragon_service.ts     versions, champions, items, spells, queues → tables statiques
├── ingestion/
│   ├── account_linker.ts      riotId#tag + platform → puuid → ligne riot_accounts
│   ├── match_sync_service.ts  incrémental + backfill (curseur persistant)
│   ├── match_ingest_service.ts  payload brut → matches + match_participants
│   ├── live_game_service.ts   spectator-v5 → cache Redis
│   ├── rank_service.ts        league-v4 → snapshots LP
│   └── jobs/                  processors BullMQ
├── stats/                     ← pur calcul, testable sans réseau
│   ├── daily_feed_service.ts
│   ├── player_stats_service.ts
│   ├── champion_pool_service.ts
│   ├── duo_stats_service.ts
│   └── leaderboard_service.ts
├── models/                    Lucid
├── controllers/               public + admin
└── validators/                Vine
```

Règle de dépendance : `controllers → stats → models`, et `jobs → ingestion → riot`. Les contrôleurs publics ne touchent **jamais** `riot/` — ils lisent la base et Redis. Ça garantit que le site reste rapide et fonctionnel même si l'API Riot est down ou la clé expirée.

### Le RiotGateway (pièce la plus critique)

Toutes les requêtes Riot, quel que soit le process, passent par `riot_gateway.ts` :

- acquisition d'un jeton sur un **token bucket Redis** (script Lua atomique) configuré à 20/1 s et 100/120 s, marges incluses ;
- lecture des headers `X-App-Rate-Limit-Count` / `X-Method-Rate-Limit-Count` pour resynchroniser le bucket sur la vérité serveur ;
- sur `429` : respect strict de `Retry-After`, réinjection du job ; sur `503` : backoff exponentiel ; sur `403` : marque la clé comme expirée en Redis et lève une bannière admin ;
- `404` sur spectator = « pas en game », pas une erreur.

**Pas de librairie tierce** (`twisted`, `shieldbow`) : on n'utilise que ~8 endpoints, et on a besoin d'un rate limiter partagé entre process que ces libs ne fournissent pas. `@fightmegg/riot-rate-limiter` sert de référence d'implémentation.

### Files BullMQ et priorités

Trois queues consommant le **même** bucket Redis, pour qu'un backfill ne fasse jamais tomber le live :

| Queue | Concurrence | Contenu |
|---|---|---|
| `live` | haute | poll spectator (toutes les 60 s par compte), refresh rank |
| `recent` | moyenne | sync incrémentale des nouveaux matchs |
| `backfill` | basse | historique de saison, curseur persistant, reprend après crash |

Jobs répétables : spectator 60 s · sync incrémentale 3 min (étalée) · snapshot LP 1 h · Data Dragon 24 h.

**Optimisation** : quand une game live disparaît (404 après avoir été présente), on enqueue immédiatement une sync `recent` pour ce compte → le match apparaît dans le feed en quelques secondes au lieu d'attendre le prochain cycle.

---

## Modèle de données (PostgreSQL)

```
groups              id, slug, name, timezone (def. Europe/Paris), created_at
members             id, slug, display_name, avatar_url, accent_color
group_members       group_id, member_id, role            (pivot → multi-groupes)
riot_accounts       id, member_id, puuid UNIQUE, game_name, tag_line, platform,
                    summoner_id, profile_icon_id, summoner_level,
                    last_synced_at, backfill_cursor, backfill_state, backfill_done_at

matches             match_id PK, platform, queue_id, game_version,
                    game_creation timestamptz, game_duration, game_mode, game_type,
                    raw jsonb, ingested_at
match_participants  (match_id, puuid) PK, team_id, champion_id, champion_name,
                    team_position, win, kills, deaths, assists, gold_earned,
                    total_minions, damage_dealt, damage_taken, vision_score,
                    wards_placed, summoner_spells, items int[], perks jsonb,
                    riot_id_game_name, riot_id_tagline, multikills
match_timelines     match_id PK, raw jsonb                (créée, non alimentée en v1)

league_entries      account_id, queue_type, tier, rank, league_points, wins, losses,
                    captured_at                            (append-only → courbe LP)
live_game_snapshots game_id PK, platform, queue_id, started_at, ended_at, raw jsonb

static_champions / static_items / static_summoner_spells / static_queues / ddragon_versions
settings            key PK, value jsonb                    (clé Riot, flags)
users               id, email, password                    (admin)
```

Points structurants :

- **On stocke les 10 participants**, pas seulement les membres du groupe. C'est ce qui permet « contre qui ils jouent », les stats de matchup, et la détection de duo (deux puuid trackés, même `match_id`, même `team_id`).
- `matches.match_id` en clé primaire → **dédoublonnage naturel** : si 4 amis jouent la même partie, elle n'est fetchée et stockée qu'une fois.
- `raw jsonb` conservé pour pouvoir ajouter une stat plus tard **sans re-fetcher** (c'est l'argument décisif pour Postgres).

Index : `matches(game_creation DESC)` · `match_participants(puuid, match_id)` · `match_participants(match_id)` · `match_participants(puuid, champion_id)` · GIN sur `matches.raw`.

---

## API (lecture publique)

```
GET /api/groups/:slug                      groupe + membres + résumé
GET /api/groups/:slug/feed?date&queue      games du jour, regroupées par match
GET /api/groups/:slug/live                 games en cours (Redis, 10 joueurs)
GET /api/groups/:slug/champions            pool de champions du groupe
GET /api/groups/:slug/duos                 matrice de synergie
GET /api/groups/:slug/leaderboards?period  classements + titres hebdo
GET /api/members/:slug                     profil + comptes + agrégats
GET /api/members/:slug/matches?cursor      historique paginé
GET /api/members/:slug/champions           pool + winrate par champion
GET /api/members/:slug/lp-history?queue    snapshots LP
GET /api/matches/:matchId                  détail d'une partie
GET /api/static/champions|items|queues     mapping id → nom/icône
```

Admin (session) : CRUD groupes / membres / comptes, `POST /api/admin/riot-key`, `GET /api/admin/sync-status`, `POST /api/admin/accounts/:id/resync`.

Ajouter un compte = `POST` avec `gameName`, `tagLine`, `platform` → `account-v1` résout le puuid → ligne créée → job `backfill` enqueué → le front affiche une progression.

---

## Front (Vite + React)

Routes : `/:group` (dashboard) · `/:group/players` · `/:group/players/:member` · `/:group/champions` · `/:group/leaderboards` · `/:group/duos` · `/:group/match/:matchId` · `/admin`.

- **TanStack Query** gère cache + `refetchInterval` (20 s sur `/live`, 60 s sur le feed). Pas de state manager global.
- Design system dans `apps/web/src/design/` : tokens de la direction A (fond `#0A0D14`, carte `#111725`, accent `#D4AF5A`, texte `#E8ECF4`, secondaire `#7A869E`, win `#4ECDA4`, loss `#E24B4A`), chiffres en mono.
- Images champions/items/runes : CDN Data Dragon directement depuis le navigateur (zéro coût API, zéro stockage).
- **ECharts** : un seul thème sombre enregistré une fois, un wrapper `<Chart>` unique. Graphes prévus : courbe LP, barres winrate par champion, heatmap calendrier d'activité, matrice de synergie duo, donut de répartition des rôles, radar de profil joueur normalisé vs moyenne du groupe, progression du pool de champions.

Le dashboard groupe affiche : bandeau **LIVE NOW** (carte par game en cours avec l'adversaire de lane), feed du jour (une carte par match, membres du groupe mis en avant côte à côte), 4 tuiles de stats du jour, et les titres de la semaine.

---

## Phasage

| Phase | Contenu | Livrable vérifiable |
|---|---|---|
| **0** | Monorepo, Docker Compose dev, Adonis + Vite qui démarrent, Postgres + Redis up | `docker compose up` → API répond, front affiche une page |
| **1** | `RiotGateway` + rate limiter + key provider + Data Dragon sync | Tests verts sur fixtures ; tables statiques peuplées |
| **2** | Schéma complet + migrations + `account_linker` + ingestion (incrémental & backfill) + queues BullMQ | Ajout d'un Riot ID → matchs en base, progression visible |
| **3** | API de lecture (feed, live, profil membre) + polling spectator | `curl /api/groups/arigafion/live` pendant une partie |
| **4** | Design system A + dashboard + live + profil joueur | Site utilisable par le groupe |
| **5** | Stats & graphes : pool de champions, duos, leaderboards, LP, titres hebdo | Pages graphes complètes |
| **6** | UI admin + déploiement VPS + Caddy | Site en ligne, clé rotable depuis l'admin |

La v1 « utilisable » = phases 0→4. Les phases 5 et 6 sont indépendantes l'une de l'autre.

---

## Tests

- **Japa** (runner Adonis) pour le backend. Priorité TDD sur les deux couches à risque :
  - `stats/*` : fonctions pures sur fixtures de matchs → tests unitaires rapides, aucun réseau.
  - `riot/rate_limiter.ts` : tests sur Redis réel (conteneur) — comportement sous 429, respect de `Retry-After`, partage entre process.
- `match_ingest_service` testé sur 2-3 payloads `match-v5` réels enregistrés (Solo, ARAM, Arena) → vérifie que les trois formats passent.
- Riot mocké par fixtures HTTP, jamais d'appel réseau en test.
- **Vitest + Testing Library** côté front pour les composants de calcul/formatage (KDA, durées, agrégations d'affichage).

## Vérification de bout en bout

1. `docker compose up` → Postgres, Redis, API, worker, web démarrent ; `GET /health` OK.
2. `node ace migration:run && node ace db:seed` → groupe `arigafion` créé.
3. Coller une Development Key valide dans `/admin`, ajouter `3C Patate Chaude#CCC` sur `euw1`.
4. Vérifier en base : ligne `riot_accounts` avec puuid, puis `matches` qui se remplit ; `GET /api/admin/sync-status` montre la progression du backfill.
5. Pendant qu'un membre est en partie : `GET /api/groups/arigafion/live` renvoie la game avec les 10 joueurs ; le dashboard l'affiche en < 60 s.
6. Fin de partie → le match apparaît dans `/api/groups/arigafion/feed` en moins d'une minute (job déclenché par la disparition du live).
7. Lancer un backfill et surveiller les logs : aucun `429` non géré, le débit reste sous 100 req/2 min (compteur exposé sur `/api/admin/sync-status`).
8. Page joueur : graphes ECharts rendus avec des données réelles, en dark mode, sans erreur console.

## Risques et points de vigilance

- **Clé dev 24 h** : tant que la Personal Key n'est pas accordée, le site s'arrête de se mettre à jour chaque jour. Mitigé par : la clé en base modifiable depuis l'admin, une bannière « key expired » côté public, et le fait que toute la partie lecture continue de fonctionner sur les données déjà en base.
- **Durée du backfill** : plusieurs heures si on ajoute 10 comptes d'un coup. Le front doit assumer l'état « syncing » plutôt que d'afficher des stats fausses.
- **Volume** : `matches.raw` pèse ~150-300 Ko par partie. 10 membres × 600 games ≈ 3-5 Go avec le dédoublonnage. Prévoir une compression ou une purge du `raw` au-delà d'un an si le VPS est petit.
- **ToS Riot** : rester sur de l'après-match et du live spectateur ; ne pas ajouter de features de dodge ou de tracking d'ults ennemis.

## À faire au démarrage de l'implémentation

- Se déplacer dans `~/Computing/Projects/Pasen` (`change_directory`), `git init`.
- Écrire et committer le spec dans `docs/superpowers/specs/2026-09-16-pasen-design.md`.
- Charger la skill `dataviz` avant d'écrire le premier graphe ECharts (palette, contraste, cohérence).

---

_Spec validée le 2026-09-16. Écarts assumés depuis, consignés ici :_

- `echarts-for-react` abandonné au profit d'un wrapper `<Chart>` maison : le paquet suit React 19 avec retard.
- Node pinné à 24.21.0 (`.nvmrc`) : AdonisJS 6 exige Node >= 24.
- `packages/shared` est compilé vers `dist/` au lieu d'être consommé en TS brut, le build Adonis ne transpilant que son propre `app/`.
- Override pnpm `jsonschema@1.4.1` : la 1.5.0 casse la validation des commandes ace ("Invalid URL" sur tout $ref).

_Constaté sur données Riot réelles (clé live, EUW, 16/09/2026) :_

- **Le nombre de participants n'est pas constant** : 10 en Faille de l'invocateur, **18** en Arena (`gameMode: CHERRY`). Tout ce qui suppose 10 casse sur l'Arena.
- **`teamPosition` peut être vide** (`""`) hors Faille — la colonne doit être nullable, pas contrainte à un enum de rôles.
- **La `queues.json` de Riot est en retard sur le jeu** : la queue 1750 est servie par l'API et absente du fichier statique. Les ids inconnus sont un cas normal ; le groupement retombe sur `gameMode`.
- **`league-v4` renvoie plus que solo/flex** : `RANKED_PREMADE_5x5` apparaît aussi. `queue_type` doit rester une chaîne libre.
- **Taille réelle d'un match brut : 79 Ko (SR) à 134 Ko (Arena)**, soit moins que les 150-300 Ko estimés. Le budget de stockage du plan est donc pessimiste d'environ moitié.

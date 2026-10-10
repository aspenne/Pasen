# Roulette des rôles — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** une page `/$group/roulette` qui montre les 10 joueurs du lobby custom en cartes de profil et révèle, en direct pour tout le monde, un rôle tiré au hasard pour chacun ; Pasen Capture fournit le lobby.

**Architecture :** Pasen Capture lit le lobby dans l'API locale du client League (LCU) et l'envoie au serveur. Le serveur garde le lobby courant du groupe, tire les rôles (fonction pure), enregistre le tirage avec une heure de révélation, et sert un état unique que chaque page interroge toutes les 2 s ; chaque page calcule elle-même les cartes retournées à partir de cette heure.

**Tech Stack :** AdonisJS 6 (Lucid, Vine, Japa), React 19 + TanStack Router/Query + Tailwind 4 (Vitest), Electron (node:test).

**Spec :** `docs/superpowers/specs/2026-10-10-role-roulette-design.md`

## Global Constraints

- Node 24 (`source ~/.nvm/nvm.sh && nvm use`).
- Rôles, dans cet ordre partout : `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY` (libellés Top, Jungle, Mid, Bot, Support).
- Au plus 5 places par équipe ; équipes `blue` (customTeam100) et `red` (customTeam200).
- Lobby périmé après 30 min ; `reveal_at = tirage + 2 s` ; une carte toutes les 650 ms, ordre Blue 1, Red 1, Blue 2…
- L'app n'envoie que les lobbies **custom** et seulement si la composition change ; lecture seule.
- Textes en anglais. Style direction B ; bleu `#4f8cff` et rouge `#ff5a4a` pour les côtés uniquement.
- Lancer les tests API fichier par fichier (`admin.spec.ts` ne rend pas la main).

## Review Focus

1. **Lobby de ranked / normal** : jamais envoyé, jamais affiché.
2. **Équipes incomplètes** (8 joueurs, 4 contre 4, un seul côté) : tirage valide, rôles vides affichés proprement.
3. **Horloge du navigateur décalée** : la révélation suit l'heure du serveur, pas celle du PC.
4. **Client League fermé, lockfile absent ou périmé** : l'app ne plante pas et réessaie.
5. **Joueur inconnu ou bot** : carte neutre, pas d'erreur.

---

## Fichiers

**API** : `app/roulette/draw_roles.ts`, `app/roulette/lobby_teams.ts` (validation/normalisation des équipes), `app/roulette/roulette_service.ts`, `app/models/custom_lobby.ts`, `app/models/role_draw.ts`, migration `1791800000000_create_roulette_tables.ts`, `app/controllers/roulette_controller.ts`, `app/controllers/admin/roulette_controller.ts`, `capture_controller.ts` (+`lobby`), `start/routes.ts`, `package.json` (alias `#roulette/*`). Tests : `tests/unit/roulette/*.spec.ts`, `tests/functional/roulette.spec.ts`.

**Capture** : `src/lcu.cjs` (lockfile + requête), `src/lobby.cjs` (extraction des équipes, comparaison), `src/main.cjs` (boucle 3 s + envoi + entrée de menu « Save lobby snapshot »), `src/pasen.cjs` (`sendLobby`), tests `test/lcu.test.cjs`, `test/lobby.test.cjs`, fixture `test/fixtures/lobby-custom.json` (provisoire, remplacée par la capture réelle).

**Web** : `lib/api.ts`, `lib/roulette.ts` (+test), `components/roulette/RoleCard.tsx`, `components/roulette/TeamEditor.tsx`, `routes/$group/roulette.tsx`, bouton dans `routes/$group/customs/index.tsx`.

---

### Task 1 : tirage et normalisation (API, pur)

- `drawRoles(teams, random = Math.random): { blue: (number|null)[]; red: (number|null)[] }` — pour chaque équipe, tableau de 5 entrées dans l'ordre des rôles, valeur = indice de la place dans `teams[side]`, `null` si personne. Permutation de Fisher-Yates avec `random` injectable.
- `normaliseTeams(input): Teams` — garde au plus 5 places par côté, coupe les noms à 40 caractères, `puuid` null pour un bot, refuse (lève) un côté qui n'est pas un tableau.
- Tests : chaque joueur un rôle unique ; 4 joueurs → un `null` ; équipe vide → 5 `null` ; aléa fixé → résultat déterministe ; normalisation (6 joueurs → 5, bot sans puuid).

### Task 2 : stockage, service, routes (API)

- Migration : `custom_lobbies(id, group_id, teams jsonb, source varchar(8) check in ('capture','manual'), created_at, updated_at)`, `role_draws(id, lobby_id → cascade, roles jsonb, reveal_at, created_at)`.
- `RouletteService` :
  - `current(group)` → dernier lobby + son dernier tirage ;
  - `ingest(group, teams, source)` → crée un lobby si la composition (puuid/nom/bot, ordre compris) diffère du courant, sinon touche `updated_at` ; renvoie `{ lobby, changed }` ;
  - `draw(group)` → tire sur le lobby courant, `reveal_at = now + 2 s` ; 409 sans lobby ;
  - `view(group, now)` → `{ serverTime, lobby: { id, source, updatedAt, stale, teams } | null, draw: { id, revealAt, roles } | null, cards: Record<puuid, Card> }` où `Card = { slug, displayName, tag, tier, rank, lp, winRate, games, championId, championName }` pour les membres (stats Summoner's Rift).
- Routes : `GET /api/groups/:slug/roulette`, `POST /api/capture/lobby`, `POST /api/admin/groups/:slug/roulette/draw`, `PUT /api/admin/groups/:slug/roulette/lobby`.
- Tests fonctionnels : 204→`lobby: null` sans lobby ; envoi app (201 nouveau, 200 inchangé, 401 jeton invalide, 422 équipe invalide) ; correction admin (401 anonyme, crée un lobby `manual`) ; tirage (401 anonyme, 409 sans lobby, 201 avec `revealAt` futur) ; carte de membre présente, invité absent de `cards`.

### Task 3 : lecture du lobby (Pasen Capture)

- `lcu.cjs` : `lockfilePaths(platform)`, `parseLockfile(text) → { port, password, protocol }`, `readLobby({ fs, request })` → corps JSON ou `null` (client fermé, 404 hors lobby, erreur réseau).
- `lobby.cjs` : `teamsFromLobby(lobby) → { blue, red } | null` (null si pas custom) ; `sameTeams(a, b)`.
- `main.cjs` : boucle 3 s quand appairé ; envoi si `teamsFromLobby` non nul et différent du dernier envoi ; entrée de menu tray **Save lobby snapshot** qui écrit la réponse brute dans `userData/lobby-snapshot.json` et l'ouvre dans le Finder/Explorateur.
- `pasen.cjs` : `sendLobby(server, token, teams)`.
- Tests : lockfile parsé ; chemins Windows/macOS ; `readLobby` renvoie null si le fichier manque ou si la requête échoue ; `teamsFromLobby` sur la fixture (provisoire) custom et sur un lobby ranked → null ; bots ; `sameTeams`.
- Version `0.4.0`.

### Task 4 : la page (site)

- `lib/roulette.ts` : `revealOrder()` (Blue1, Red1, …), `revealedCount(revealAt, serverOffsetMs, now)`, `discordText(view)` ; tests.
- `RoleCard` : face cachée (PASEN, pseudo) / face visible (splash, bordure de rang, nom, rang, 2 stats, champion le plus joué, logo de rôle CommunityDragon, nom du rôle) ; variantes invité, bot, place vide.
- `TeamEditor` (admin) : par équipe, liste + ajout d'un membre (select) + retrait + changement de côté ; enregistre via `PUT`.
- Route `/$group/roulette` : interroge toutes les 2 s, calcule le décalage `serverTime - Date.now()`, rend Blue/Red, boutons admin **Draw roles** / **Reroll** / **Edit teams**, **Copy for Discord** une fois tout révélé ; état « Last lobby seen at … » si périmé ; état vide avec explication.
- Bouton **Role roulette** en tête de la page Customs.
- Vérification navigateur : desktop 1440×900 (10 cartes visibles), mobile 375 px (3 colonnes, pas de défilement horizontal).

### Task 5 : livraison

- Suites complètes, déploiement du site après accord, publication de Pasen Capture 0.4.0 après accord. La lecture du lobby est confirmée avec le fichier **Save lobby snapshot** pris par l'utilisateur dans un vrai lobby ; la fixture provisoire est alors remplacée par ce fichier et les tests relancés.

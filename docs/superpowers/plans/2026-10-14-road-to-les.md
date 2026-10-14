# Road to LES — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal :** un onglet `LES` qui classe chaque compte du groupe par LP gagnés en Solo/Duo depuis le 1er octobre 2026, jusqu'à la Lyon e-Sport le 13 novembre.

**Spec :** `docs/superpowers/specs/2026-10-14-road-to-les-design.md`

## Global Constraints

- Début `2026-10-01T00:00` et fin `2026-11-13T00:00`, heure de Paris (`Europe/Paris`).
- File `RANKED_SOLO_5x5` seulement ; un classement par compte.
- Échelle de points : 100 LP par division depuis Fer IV 0 = 0, Master 0 LP = 2800, apex compté depuis Master.
- Textes en anglais ; style direction B ; tests API fichier par fichier.

### Task 1 : l'échelle de points dans `@pasen/shared`
- `ladder.ts` : `ladderPoints({ tier, rank, leaguePoints })`, `pointsLabel(points)` ; tests vitest.
- Le site importe désormais l'échelle depuis `@pasen/shared` (`lib/ladder.ts` garde `laneGap`, `teamAverage`, `signed`).

### Task 2 : le calcul (API, pur)
- `app/events/les_board.ts` : `LES_EVENT`, `lesBoard(accounts, readings, now)` → `LesBoard` (départ, arrivée, LP, games, `since`, tri, totaux, `finished`).
- Tests : départ avant / après le début, arrivée bornée par la fin, promotion Diamant → Master, perte, games depuis wins/losses, jamais classé, sans game, tri, totaux.

### Task 3 : service, route, cache (API)
- `LesService.board(group)` : comptes du groupe + relevés Solo/Duo utiles, appelle `lesBoard` ; cache mémoire 5 min par groupe.
- `GET /api/groups/:slug/events/les` ; test fonctionnel sur relevés seedés.

### Task 4 : la page (site)
- `lib/les.ts` : `countdownLabel(endsAt, now)`, `sinceLabel(since)` ; tests.
- Route `/$group/les`, onglet `LES` dans `groupNav`, bandeau d'accueil tant que l'event n'est pas fini.
- Vérification navigateur desktop et 375 px.

### Task 5 : livraison
- Suites complètes, déploiement après accord.

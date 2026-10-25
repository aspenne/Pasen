# Drafter fearless et filtre par rôle — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Spec :** `docs/superpowers/specs/2026-10-25-fearless-drafter-design.md`

## Global Constraints
- Rôles : `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY` ; Meraki `SUPPORT` → `UTILITY`.
- Ordre des 20 étapes figé dans un seul module partagé (`@pasen/shared`).
- Jetons de place : 24 octets aléatoires, seul le sha256 en base, jamais dans l'URL.
- Tests API fichier par fichier ; textes en anglais ; direction B.

### Task 1 : rôles des champions (API)
Migration `positions`, `championPositions(meraki)` pur + repli sur la lane jouée dans `DDragonService`, exposé par `/api/static`. Tests.

### Task 2 : règles de draft (`@pasen/shared`)
`DRAFT_STEPS`, `stepAt(i)`, `validateAction(state, action)`, `defaultRole(positions, taken)`. Tests vitest.

### Task 3 : drafts (API)
Migration `drafts` + `draft_actions`, modèles, `DraftService` (create, seats, hover, act, view, history), contrôleurs et routes publiques + admin. Tests fonctionnels.

### Task 4 : filtre par rôle (site)
`lib/roles.ts` (filtre) + test ; boutons dans `FearlessGrid`.

### Task 5 : page du drafter (site)
Client API, `lib/draft.ts` (minuteur, rangement par rôle) + tests, route `/$group/draft`, bouton Draft et historique sur la page Fearless. Vérification navigateur.

### Task 6 : relecture et livraison
Relecture fraîche, correctifs, merge et déploiement après accord.

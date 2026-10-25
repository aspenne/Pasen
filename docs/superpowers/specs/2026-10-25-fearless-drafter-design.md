# Drafter fearless et filtre par rôle

## Contexte

Les customs d'ARIGAFION se jouent en fearless. La page Fearless dit ce qui est
grillé ; il manque l'endroit où la draft elle-même se fait. Inspiration :
drafter.lol — deux capitaines bannissent et choisissent tour par tour, tout le
monde regarde en direct. En plus, les grilles de champions se filtrent par rôle.

### Décisions validées

| Sujet | Choix |
|---|---|
| Qui drafte | **2 capitaines en direct**, chacun sur son navigateur ; les autres regardent |
| Places | **Le premier qui clique** prend Blue ou Red ; place liée au navigateur, **Leave seat**, l'admin peut libérer une place |
| Format | **Tournoi**, 20 étapes (ci-dessous) |
| Minuteur | **30 s indicatif** : affiché, rien ne se passe à zéro |
| Grillés | **Impossibles à choisir** (ni pick ni ban) pendant une soirée fearless active |
| Fearless | La draft **ne grille rien** ; seules les games envoyées grillent, comme aujourd'hui ; les bans ne comptent pas |
| Joueurs | Repris de la **roulette** (lobby + rôles tirés) ; chaque pick se place devant le joueur de son rôle |
| Sans fearless | Draft possible, sans grillés |
| Après | **Historique** des drafts de la soirée sous la page Fearless |
| Place | Bouton **Draft** sur la page Fearless |
| Rôles | **Base publique** (Meraki Analytics), sinon la lane où le groupe joue le champion |
| Filtre | Grille de la page Fearless **et** grille du drafter |
| Textes | Anglais |

---

## 1. Rôles des champions

- Nouvelle colonne `static_champions.positions` (jsonb, liste parmi `TOP`,
  `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`).
- Remplie à chaque synchro Data Dragon depuis
  `cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json`
  (champ `positions`, `SUPPORT` → `UTILITY`), associée par id numérique.
- Champion absent de Meraki (les plus récents) : la lane la plus jouée avec lui
  dans les games stockées (au moins 3 games) ; sinon aucune.
- Meraki indisponible : on garde les rôles déjà en base, la synchro ne casse pas.
- Servie avec les données statiques (`GET /api/static`, `champions[id].positions`).
- Filtre **All / Top / Jungle / Mid / Bot / Support** : un champion à plusieurs
  rôles apparaît dans chacun ; « All » montre tout.

## 2. Le drafter

### Ordre (format tournoi)

| Étapes | Phase | Côtés |
|---|---|---|
| 1–6 | Bans | B R B R B R |
| 7–12 | Picks | B R R B B R |
| 13–16 | Bans | R B R B |
| 17–20 | Picks | R B B R |

### Données

```
drafts          id, group_id, fearless_night_id (null), blue_seat (hash, null),
                red_seat (hash, null), hover_champion_id (null), step_started_at,
                finished_at (null), created_at
draft_actions   id, draft_id, step (0-19), side, kind 'ban'|'pick',
                champion_id, role (pick seulement, null si pas de rôles), created_at
                UNIQUE (draft_id, step), UNIQUE (draft_id, champion_id)
```

- `fearless_night_id` : la soirée active à la création, sinon null.
- L'étape courante = nombre d'actions ; finie à 20.

### Règles (fonction pure, testée)

- On ne joue qu'à son tour, avec le jeton de sa place.
- Un champion ne sert qu'une fois par draft (ban ou pick).
- Pendant une soirée active, un champion grillé (tableau fearless courant) est
  refusé.
- Un pick porte un rôle parmi ceux encore libres de son côté ; par défaut le
  premier rôle libre que le champion sait jouer, sinon le premier libre.
- **Hover** : à son tour, le capitaine peut présélectionner un champion ; tout le
  monde le voit en surbrillance. Lock in valide.

### Places

- `POST …/drafts/:id/seats` `{ side }` → jeton aléatoire (gardé dans le
  navigateur, seul son hash en base) si la place est libre, sinon 409.
- `DELETE …/drafts/:id/seats/:side` avec le jeton → **Leave seat**.
- Admin : `DELETE /api/admin/drafts/:id/seats/:side` → libère sans jeton.

### Création

- N'importe qui crée une draft avec **New draft** s'il n'y en a pas d'ouverte
  dans le groupe ; une draft ouverte se termine à 20 étapes ou est annulée par
  l'admin (`DELETE /api/admin/drafts/:id`).

### API

```
GET    /api/groups/:slug/drafts/current     dernière draft (ouverte ou finie), heure serveur
GET    /api/groups/:slug/drafts?night=:id   drafts d'une soirée (historique)
POST   /api/groups/:slug/drafts             nouvelle draft (409 si une est ouverte)
POST   /api/groups/:slug/drafts/:id/seats   prendre une place
DELETE /api/groups/:slug/drafts/:id/seats/:side   quitter (jeton)
PUT    /api/groups/:slug/drafts/:id/hover   { token, championId }
POST   /api/groups/:slug/drafts/:id/actions { token, championId, role? }
DELETE /api/admin/drafts/:id                annuler
DELETE /api/admin/drafts/:id/seats/:side    libérer une place
```

Le jeton circule dans le corps (ou un en-tête), jamais dans l'URL.

### Page — `/$group/draft`

- Bouton **Draft** sur la page Fearless.
- En haut : les 10 cases de bans (5 par côté), le minuteur indicatif (30 s depuis
  `step_started_at`, heure serveur) et « Blue picking » / « Red banning ».
- Colonnes Blue et Red : les 5 rôles, le joueur tiré par la roulette pour ce
  rôle s'il y en a un, le champion choisi.
- Au centre : recherche, filtre de rôle, grille ; grillés / bannis / pris
  grisés et barrés ; le champion survolé par le capitaine en cours en
  surbrillance.
- Capitaine à son tour : clic = hover, **Lock in**, choix du rôle pour un pick.
- **Take Blue seat / Take Red seat / Leave seat** ; l'admin voit **Free seat** et
  **Cancel draft**.
- Rafraîchie toutes les secondes.
- Fin : récap ; la page Fearless liste les drafts de la soirée.

## Tests

- **Rôles** : correspondance Meraki → nos clés, repli sur la lane jouée, synchro
  sans Meraki.
- **Règles** (pur) : ordre des 20 étapes, tour, doublon, grillé, rôle par défaut,
  fin.
- **API** : création (409 si ouverte), places (409, jeton, admin), action hors
  tour (403), grillé (422), historique par soirée.
- **Site** : filtre de rôle, minuteur, ordre d'affichage des picks par rôle.

## Hors périmètre

- Minuteur qui force un choix ; échange de picks entre joueurs ; draft
  « pour le fun » avec mode de jeu autre que la Faille.

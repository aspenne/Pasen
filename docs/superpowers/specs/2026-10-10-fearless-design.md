# Fearless — les champions grillés d'une soirée de customs

## Contexte

Les customs d'ARIGAFION se jouent en **fearless** : un champion joué dans une
game de la soirée ne peut plus être joué de la soirée. Pendant la draft, il faut
savoir tout de suite ce qui est encore libre.

Pasen a déjà la donnée : chaque custom envoyée par Pasen Capture contient les
dix champions de la partie. Il manque la notion de **soirée**, et un écran qui
réponde à la question qu'on se pose en draft : « ce champion est dispo ? ».

### Décisions validées

| Sujet | Choix |
|---|---|
| Règle | **Hard fearless** : un champion joué par n'importe qui est grillé pour tout le monde, des deux côtés |
| Découpage | **L'admin lance la soirée** ; elle finit sur « Terminer », ou toute seule **6 h** après son début |
| Affichage | **Page du site** d'abord, puis un rappel dans **Pasen Capture** (nouvelle version de l'app) |
| Contenu | **Grille de tous les champions** (grillés grisés et barrés) + recherche, puis le détail game par game |
| Corrections admin | **Griller à la main**, **exclure une game**, **libérer un champion** |
| Stockage | **Calculé à la lecture** à partir des customs du créneau, jamais recopié |

### Contrainte d'usage

Pasen ne voit une game qu'une fois que quelqu'un a cliqué **Send to Pasen**. La
liste n'est juste à la draft suivante que si la custom précédente a été envoyée
entre-temps. La page le rappelle, et Pasen Capture aussi (partie 2).

---

## Données

Deux tables, dans une migration.

```
fearless_nights        id, group_id → groups, label (nullable, ≤ 80),
                       started_at timestamptz, ended_at timestamptz (nullable),
                       excluded_custom_ids jsonb (défaut '[]'), created_at

fearless_adjustments   id, night_id → fearless_nights (cascade),
                       champion_id int, kind 'burn' | 'free',
                       decided_at timestamptz
                       UNIQUE (night_id, champion_id)
```

- Une soirée appartient à un groupe. **Au plus une soirée active par groupe** :
  en lancer une nouvelle met `ended_at = now()` sur la précédente si elle était
  encore ouverte.
- `excluded_custom_ids` plutôt qu'une table : quelques entiers par soirée, lus
  et écrits en bloc. En `jsonb`, comme les autres listes d'entiers du schéma
  (`match_participants.items`). Supprimer une custom du site la fait de toute façon sortir
  du créneau ; un id orphelin dans la liste est sans effet.
- **Une seule correction par champion** et par soirée. Changer d'avis remplace
  la ligne (upsert) et remet `decided_at` à l'heure du changement ; annuler une
  correction supprime la ligne.

### Fin effective

`fin = min(ended_at, started_at + 6 h)` — `ended_at` nul compte comme l'infini.
Une soirée est **active** tant que `now() < fin`. Rien n'est écrit en base à
6 h : la fermeture automatique est une règle de lecture, donc elle ne dépend
d'aucun job.

---

## Calcul

Une fonction pure, `fearlessBoard(night, games, adjustments, now)`, dans
`apps/api/app/fearless/`, testée sans base.

**Entrées**
- la soirée (début, fin effective, customs exclues) ;
- les customs du groupe dont la **fin** (`played_at + duration`) tombe dans
  `[started_at, fin)`, déjà passées par `viewCustomGame` (qui reconstruit l'id
  de chaque champion et le joueur derrière) ;
- les corrections de la soirée.

`played_at` est l'heure de **début** de la partie (l'heure de capture moins le
chrono du jeu), d'où le calcul de la fin. Une game commencée avant le lancement
de la soirée et finie après compte donc dans la soirée, ce qui est le
comportement voulu (on lance la soirée en retard, pas en avance).

**Règle, champion par champion**
1. Les **picks** du champion = chaque joueur qui l'a joué dans une custom non
   exclue du créneau, **bots compris** (en hard fearless, tout le lobby compte).
   Une game contre des bots ne fait pas exception : si c'était de
   l'entraînement, l'admin l'exclut.
2. Correction `burn` → **grillé**, quels que soient les picks.
3. Correction `free` → les picks des games **finies avant** la correction ne
   comptent plus. Un pick dans une game finie **après** la libération le regrille :
   libérer un champion accorde une exception, pas une immunité pour la soirée.
4. Sinon, grillé dès qu'il a au moins un pick.

**Sortie**

```ts
type FearlessBoard = {
  night: { id, label, startedAt, endsAt, active: boolean }
  games: {                         // dans l'ordre où elles ont été jouées
    id, number,                    // number : 1, 2, 3… parmi les non exclues
    label, playedAt, excluded: boolean,
    picks: { championId, championName, playerName, memberSlug, side }[]
  }[]
  burned: {                        // un par champion grillé
    championId,
    source: 'played' | 'manual',
    by: { playerName, memberSlug, gameNumber }[]   // vide si 'manual'
  }[]
  freed: number[]                  // champions libérés à la main
}
```

Les games exclues restent dans `games` (avec `excluded: true` et sans numéro)
pour que l'admin puisse les réinclure depuis la page.

---

## API

**Public**

```
GET /api/groups/:slug/fearless          la soirée active, sinon la dernière
                                        terminée ; 204 si le groupe n'en a jamais eu
```

**Admin** (session, comme les customs)

```
POST   /api/admin/groups/:slug/fearless             lancer une soirée { label? }
PATCH  /api/admin/fearless/:id                      { label?, ended: true?, excludedCustomIds? }
PUT    /api/admin/fearless/:id/champions/:champion  { kind: 'burn' | 'free' }
DELETE /api/admin/fearless/:id/champions/:champion  annuler la correction
```

- Corriger une soirée terminée reste permis : on rattrape une erreur après coup.
- `excludedCustomIds` ne garde que des ids de customs du groupe.
- Un champion inconnu de `static_champions` → 422.

**Pasen Capture (partie 2)**

```
GET /api/capture/fearless               même réponse que la route publique,
                                        pour le groupe du jeton Bearer
```

Le jeton de l'app est limité aujourd'hui à `whoami` et à l'envoi des customs ;
cette route s'ajoute à la liste, en lecture seule.

---

## Page du site — `/$group/fearless`

**En tête.** Le nom de la soirée (ou « Fearless »), l'heure de lancement, l'état
(**En cours** ou **Terminée**) et le compteur « 23 grillés · 147 libres ». Pour
l'admin : **Lancer une soirée fearless** (et **Terminer** si elle est en cours).
Sans aucune soirée : un état vide qui explique le principe, et le bouton pour
l'admin.

**Recherche.** Un champ en haut, filtre la grille à la frappe sur le nom
(insensible aux accents et à la casse : « nunu » trouve « Nunu & Willump »).
Quand un seul champion reste, une phrase répond directement : « Ahri est
libre » ou « Ahri est grillée — jouée par Nøah en game 2 ».

**Grille.** Tous les champions de `static_champions`, par ordre alphabétique.
Un grillé est grisé et barré, et garde son icône lisible ; c'est la forme,
pas seulement la couleur, qui le distingue. Option « Masquer les grillés »
pour ne voir que ce qui reste. Au survol ou au toucher : qui l'a joué et dans
quelle game, ou « grillé à la main ».

Pour l'admin, chaque case ouvre un petit menu : **Griller**, **Libérer**,
**Annuler la correction** selon l'état.

**Détail game par game.** Une ligne par custom de la soirée : « Game 2 », son
nom, l'heure, et les dix champions par côté. Lien vers la page de la custom.
Pour l'admin : **Exclure** / **Réinclure**.

**Rappel.** Sous le compteur, tant que la soirée est active : « Pensez à envoyer
chaque game depuis Pasen Capture : la liste se met à jour à l'envoi. »

**Mise à jour.** Requête rafraîchie toutes les **20 s** tant que la soirée est
active, et pas du tout une fois terminée.

**Accès.** Une entrée **Fearless** dans la navigation du groupe, à côté de
Customs. Sur l'accueil, un bandeau « Soirée fearless en cours — 23 grillés »
vers la page, seulement quand une soirée est active.

Textes de l'interface en **anglais**, comme tout le site (les phrases ci-dessus
sont traduites à l'implémentation). Style : direction B, comme le reste du site. Grille dense et tactile (cases
d'au moins 44 px sous pointeur grossier), lisible sur téléphone.

---

## Pasen Capture — partie 2

Livrée après la page, dans une version `capture-v0.2.0`.

- Un encart en haut de l'app quand une soirée est active : « Fearless en cours ·
  23 grillés » et **Voir la liste**, qui ouvre la page du site.
- Sur chaque capture pas encore envoyée, tant que la soirée est active : « Envoie
  cette game pour mettre la liste fearless à jour. »
- L'app interroge `/api/capture/fearless` toutes les 60 s, et juste après chaque
  envoi. Sans réseau ou sans soirée, l'encart disparaît sans erreur.

La grille complète reste sur le site : l'app est cachée derrière le client
League pendant la draft, la recopier n'apporterait rien.

---

## Tests

- **Calcul** (Japa, unitaire) : créneau et fin à 6 h ; `ended_at` avant 6 h ;
  game exclue ; bots comptés ; `burn` manuel ; `free` puis repick qui regrille ;
  `free` sans repick ; numérotation des games quand une game est exclue.
- **API** (Japa, fonctionnel) : lancer une soirée ferme la précédente ; 204 sans
  soirée ; corrections admin protégées (401 sans session) ; 422 sur un champion
  inconnu ; le jeton de capture lit la soirée de son groupe et rien d'autre.
- **Front** (Vitest) : la recherche (accents, casse, « Nunu & Willump ») et la
  phrase de réponse à un seul résultat.
- **Capture** (node:test) : l'encart suit la réponse de l'API, et disparaît sans
  réseau.

## Hors périmètre

- Historique des soirées passées (la page montre la dernière seulement).
- Les **bans** : l'API Live Client ne les expose pas, et le fearless ne porte que
  sur les picks.
- Annonce Discord du lancement ou de la fin d'une soirée.

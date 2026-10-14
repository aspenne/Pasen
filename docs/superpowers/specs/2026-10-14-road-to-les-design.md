# Road to LES — le défi LP avant la Lyon e-Sport

## Contexte

ARIGAFION va à la **Lyon e-Sport** (LAN) le **13 novembre 2026**. Pour pousser
tout le monde à jouer d'ici là, un onglet **LES** montre qui a gagné le plus de
LP en Solo/Duo depuis le **1er octobre**, et combien de games chacun a jouées.

### Décisions validées

| Sujet | Choix |
|---|---|
| Mesure | **LP gagnés depuis le 1er octobre 2026** (00:00, heure de Paris) |
| Fin | **13 novembre 2026** (00:00, heure de Paris) : le classement se fige, compte à rebours jusque-là |
| File | **Solo/Duo uniquement** |
| Qui | **Tout le groupe**, **un classement par compte** : un membre à deux comptes a deux lignes |
| Dates | Écrites dans le code (event ponctuel), pas d'écran d'admin |
| Textes | Anglais, comme le reste du site |

---

## Données

Rien de nouveau à stocker : tout vient de `league_entries`, l'historique des
rangs relevé toutes les heures (`riot_account_id, queue_type, tier, rank,
league_points, wins, losses, captured_at`).

En production au 14 octobre : 28 comptes classés en Solo/Duo, dont **24 avec un
relevé avant le 1er octobre**.

### Par compte

- **Départ** : le dernier relevé Solo/Duo **au plus tard** au début de l'event.
  À défaut (compte ajouté après), le **premier relevé après** ; la ligne porte
  alors `since` = la date de ce relevé (« since added on 6 Oct »).
- **Arrivée** : le dernier relevé **au plus tard** à la fin de l'event (donc le
  plus récent tant que l'event court).
- **LP gagnés** = `points(arrivée) − points(départ)`, sur l'échelle unique
  du site : 100 LP par division depuis Fer IV 0 LP = 0, Master 0 LP = 2800,
  Grandmaster et Challenger comptés depuis Master. Une promotion compte ses vrais
  LP ; un passage en Master compte comme +LP, pas comme une remise à zéro.
- **Games, victoires, défaites** = différence de `wins` et `losses` entre départ
  et arrivée : le compteur officiel de Riot, pas les games que Pasen a récupérées.
- **Sans aucun relevé Solo/Duo** (jamais classé) : ligne « Unranked », 0 game.
- Un compte qui n'a pas joué : 0 game, 0 LP, rang inchangé.

L'échelle de points est la même que celle de la roulette ; elle passe dans
`@pasen/shared` pour que l'API et le site utilisent le même code.

---

## API

```
GET /api/groups/:slug/events/les
```

```ts
type LesBoard = {
  event: { name: 'Lyon e-Sport'; startsAt: string; endsAt: string; finished: boolean }
  totals: { lpGained: number; games: number; activeAccounts: number; accounts: number }
  entries: {
    memberSlug: string
    displayName: string
    riotId: string
    profileIconId: number | null
    start: { tier: string | null; rank: string | null; leaguePoints: number } | null
    current: { tier: string | null; rank: string | null; leaguePoints: number } | null
    lpGained: number
    games: number
    wins: number
    losses: number
    /** Set when the account has no reading before the event: where its count starts. */
    since: string | null
  }[]
}
```

Tri : LP gagnés décroissants, puis games décroissantes, puis nom. `totals.lpGained`
additionne les LP gagnés de tous les comptes (pertes comprises) ; `activeAccounts`
= comptes avec au moins 1 game.

Lecture seule et publique, comme le reste du site. Cache serveur de 5 min (les
relevés sont horaires).

---

## Page — `/$group/les`

- **Onglet** « LES » dans le menu du groupe, après Fearless.
- **En tête** : « Road to Lyon e-Sport », le compte à rebours (« 30 days to go »,
  puis « Today » le jour J, puis « Final standings » après), la règle en une
  ligne.
- **Trois chiffres** : LP gagnés par le groupe, games jouées, comptes actifs
  (« 17 of 28 played »).
- **Deux mises en avant** : meilleure progression (LP) et plus de games.
- **Classement** : place, avatar et nom (lien profil), Riot ID si le membre a
  plusieurs comptes, rang de départ → rang actuel, LP gagnés (vert / rouge), games
  avec bilan ; bascule de tri **LP** / **Games** ; les comptes à 0 game en bas
  avec « No game yet — get on it ».
- **Accueil du groupe** : un bandeau tant que l'event n'est pas fini —
  « Road to LES · 30 days to go · leading: Nøah +450 LP » — vers la page.
- Style direction B ; mobile : la ligne passe sur deux lignes, pas de défilement
  horizontal.

---

## Tests

- **Échelle de points** (shared) : déjà couverte côté site, déplacée avec ses tests.
- **Calcul** (pur) : départ avant/après le 1er, arrivée bornée par la fin, promotion
  Diamant → Master, perte de LP, games depuis wins/losses, compte jamais classé,
  compte sans game, tri, totaux.
- **API** : réponse sur des relevés seedés, figée après la fin.
- **Site** : libellé du compte à rebours (avant, jour J, après), libellé « since ».

## Hors périmètre

- Dates réglables depuis l'admin, plusieurs events.
- Annonce Discord automatique.
- Classement par membre (comptes additionnés).

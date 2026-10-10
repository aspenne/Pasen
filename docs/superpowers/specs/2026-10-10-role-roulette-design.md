# Roulette des rôles — tirer et révéler les rôles d'une custom

## Contexte

En custom, ARIGAFION tire les rôles au hasard. Le but : une page où les 10
joueurs du lobby apparaissent en cartes façon écran de chargement LoL, et où
leurs rôles se révèlent un par un, en direct pour tout le monde.

Un prototype jetable (cartes de profil réelles, splash du champion le plus
joué, logo de rôle Riot, retournement alterné) a validé le visuel.

### Décisions validées

| Sujet | Choix |
|---|---|
| Source des joueurs | **Le lobby de partie personnalisée, lu par Pasen Capture** dans le client League, avant le lancement |
| Équipes | **Déjà faites dans le lobby** ; la roulette tire seulement les rôles dans chaque équipe |
| Partage | **Tout le monde en direct** : le tirage est fait et enregistré par le serveur, chaque page révèle au même rythme |
| Secours | **L'admin peut corriger le lobby à la main** : ajouter un membre, changer un joueur d'équipe, en retirer un — et donc lancer sans aucune app |
| Visuel | Écran de chargement : Blue en haut, Red en bas, cartes de profil compactes, gros logo du rôle, retournement alterné Blue/Red |
| Textes | Anglais, comme le reste du site et de l'app |

---

## 1. Lecture du lobby (Pasen Capture)

Le client League expose une API locale (« LCU ») sur `https://127.0.0.1:<port>`,
avec un mot de passe, tous deux écrits dans le fichier `lockfile` du dossier
d'installation :

- Windows : `C:\Riot Games\League of Legends\lockfile` (par défaut) ;
- macOS : `/Applications/League of Legends.app/Contents/LoL/lockfile`.

Format : `nom:pid:port:motdepasse:protocole`. Authentification Basic
`riot:<motdepasse>`, certificat auto-signé (vérification désactivée pour
`127.0.0.1` seulement, comme pour l'API Live Client).

L'app lit `GET /lol-lobby/v2/lobby` toutes les **3 s** quand le client est
ouvert et qu'aucune partie n'est en cours. Elle n'envoie que si :

- le lobby est une **partie personnalisée** (`gameConfig.isCustom` vrai) ;
- la composition a **changé** depuis le dernier envoi.

Elle n'envoie jamais un lobby de ranked ou de normal, et ne fait que lire :
aucune action dans le client.

**Format inconnu à ce jour.** Je ne peux pas faire tourner le client League.
La première tâche du plan est une **version de test** qui écrit la réponse
brute du lobby dans un fichier : l'utilisateur la lance une fois dans un lobby
custom à 10 et transmet le fichier. Le reste de la lecture (champs des équipes,
du puuid, du nom) est écrit et testé contre ce fichier réel. Attendu, d'après
les outils existants : `gameConfig.customTeam100` et `customTeam200`, avec pour
chaque joueur au moins `puuid` et un nom (`summonerName` ou `gameName` +
`tagLine`), les bots marqués, les spectateurs à part.

Envoi : `POST /api/capture/lobby` avec le jeton de l'app :

```json
{ "teams": { "blue": [{ "puuid": "…", "name": "Nøah#SHEN", "bot": false }],
             "red":  [ … ] } }
```

Les bots du lobby sont envoyés (un bot a aussi un rôle) avec `bot: true` et
sans puuid.

---

## 2. Côté Pasen

### Données

```
custom_lobbies     id, group_id → groups, teams jsonb, source 'capture' | 'manual',
                   updated_at timestamptz, created_at
role_draws         id, lobby_id → custom_lobbies (cascade), roles jsonb,
                   reveal_at timestamptz, created_at
```

- **Un lobby courant par groupe** : la ligne la plus récente. Un envoi de
  l'app crée un nouveau lobby si la composition diffère, sinon rafraîchit
  `updated_at`. Une correction de l'admin crée un nouveau lobby `manual`
  (l'app ne l'écrase que si le lobby réel change ensuite).
- Le lobby est **périmé après 30 min** sans mise à jour : la page l'affiche
  alors comme « dernier lobby vu à 21:42 », sans le cacher.
- `teams` : `{ blue: Seat[], red: Seat[] }`, `Seat = { puuid | null, name, bot }`,
  au plus 5 par équipe.
- `roles` : pour chaque équipe, la liste des places dans l'ordre Top, Jungle,
  Mid, Bot, Support (indices dans `teams`). Une équipe de moins de 5 laisse des
  rôles vides.

### Tirage

Fonction pure `drawRoles(teams, random)` : une permutation aléatoire par
équipe, `random` injectable pour les tests. Le serveur l'appelle, enregistre le
tirage avec `reveal_at = maintenant + 2 s` (le temps que toutes les pages le
reçoivent), et le renvoie. **Reroll** = un nouveau tirage sur le même lobby.

### Synchronisation

Pas de websocket : la page interroge `GET /api/groups/:slug/roulette` toutes
les **2 s**. La réponse porte le lobby, le dernier tirage et l'heure du serveur.
Chaque page calcule, à partir de `reveal_at` et du décalage d'horloge avec le
serveur, combien de cartes sont retournées : carte *k* (Blue 1, Red 1, Blue 2…)
à `reveal_at + k × 650 ms`. Arriver en retard montre directement l'état
courant.

### Cartes

Pour chaque place :

- **membre** (puuid connu) : nom affiché, tag, rang solo, winrate et nombre de
  games en Summoner's Rift, champion le plus joué (splash « centered ») ;
- **invité** (puuid inconnu de Pasen) : carte neutre, pseudo du lobby, sans
  stats ;
- **bot** : carte neutre « Bot ».

Les données de carte sont calculées côté serveur dans la réponse de la
roulette (pas dix appels depuis la page).

### API

```
GET    /api/groups/:slug/roulette            lobby courant + dernier tirage + cartes + heure serveur
POST   /api/capture/lobby                    (jeton de l'app) composition du lobby
POST   /api/admin/groups/:slug/roulette/draw (admin) tirer / retirer les rôles
PUT    /api/admin/groups/:slug/roulette/lobby (admin) remplacer la composition à la main
```

---

## 3. La page — `/$group/roulette`

- Entrée : un bouton **Role roulette** en tête de l'onglet Customs (pas dans le
  menu principal).
- **Sans lobby** : explication (« Open a custom lobby with Pasen Capture
  running, or set the teams by hand ») et, pour l'admin, l'éditeur.
- **Lobby, pas de tirage** : 10 cartes face cachée (logo PASEN, pseudo). Pour
  l'admin : **Draw roles**.
- **Tirage** : retournement synchronisé, Blue puis Red en alternance, logo du
  rôle qui apparaît avec un rebond, équipes rangées Top → Support pour que les
  adversaires de lane soient face à face. Pour l'admin : **Reroll**.
- **Copy for Discord** une fois tout révélé :
  `Blue — Top: Nøah · Jungle: … ` / `Red — …`.
- **Éditeur admin** (« Edit teams ») : pour chaque équipe, ajouter un membre du
  groupe (recherche), retirer, changer d'équipe.
- Mise en page : les 10 cartes tiennent sur un écran de 1440×900 ; sous
  ~760 px, 3 cartes par ligne et défilement. Animations coupées sous
  `prefers-reduced-motion`.
- Style direction B ; seules exceptions : bleu et rouge des côtés (convention
  LoL), comme sur le prototype.

---

## Tests

- **API** : `drawRoles` (un rôle chacun, équipes incomplètes, aléa injecté) ;
  envoi d'un lobby par l'app (nouveau si différent, rafraîchi sinon, refus d'un
  jeton invalide) ; correction admin protégée ; tirage protégé ; cartes membre /
  invité / bot.
- **Capture** : lecture du `lockfile` (Windows et macOS), filtrage
  custom/non-custom, détection de changement, extraction des équipes **contre le
  fichier réel** capturé par la version de test.
- **Site** : calcul des cartes retournées à partir de `reveal_at` et du décalage
  d'horloge ; texte « Copy for Discord ».

## Hors périmètre

- Contraintes de tirage (rôles préférés, éviter de rejouer le même rôle).
- Tirage des équipes.
- Historique des tirages.
- Envoi automatique dans Discord.

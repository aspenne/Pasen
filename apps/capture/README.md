# Pasen Capture

**Une petite app à installer sur le PC où tu joues.** Elle enregistre tes parties
personnalisées (les « customs », vos inhouses entre potes) et les envoie sur
[Pasen](https://aspenne.tech/arigafion/customs) en un clic.

Pourquoi il faut une app : Riot garde les parties classées et normales, mais
**ne garde aucune trace des customs**. Une fois la partie terminée, elle disparaît.
Pasen Capture la récupère juste avant, pendant que League l'affiche encore.

> Tu n'as besoin de rien connaître en informatique. Compte 5 minutes la première
> fois, ensuite tu n'y touches plus.

---

## Sommaire

1. [Télécharger l'app](#1-télécharger-lapp)
2. [L'installer](#2-linstaller)
3. [Relier ton PC à Pasen](#3-relier-ton-pc-à-pasen)
4. [Jouer et envoyer tes parties](#4-jouer-et-envoyer-tes-parties)
5. [Questions fréquentes et soucis](#5-questions-fréquentes-et-soucis)
6. [Pour la personne qui gère le site](#6-pour-la-personne-qui-gère-le-site)

---

## 1. Télécharger l'app

Va sur la page **[Pasen Capture — téléchargements](https://github.com/aspenne/Pasen/releases/latest)**
et prends **un seul** fichier, selon ton ordinateur :

| Ton ordinateur | Le fichier à prendre |
|---|---|
| **Windows** (10 ou 11) | `Pasen-Capture-Setup-…exe` |
| **Mac récent** (puce Apple M1, M2, M3…) | `Pasen-Capture-…-arm64.dmg` |
| **Mac plus ancien** (processeur Intel) | `Pasen-Capture-…-x64.dmg` |

**Tu as un Mac et tu ne sais pas lequel ?** Clique sur la pomme  en haut à
gauche de l'écran, puis **À propos de ce Mac**. Si tu lis « Puce Apple M… », prends
`arm64`. Si tu lis « Processeur Intel », prends `x64`.

---

## 2. L'installer

### Sur Windows

1. Double-clique sur le fichier `.exe` que tu viens de télécharger.
2. Une fenêtre bleue **« Windows a protégé votre ordinateur »** peut apparaître.
   C'est normal : l'app n'est pas « signée » (une signature coûte plusieurs
   centaines d'euros par an), donc Windows ne la connaît pas.
   - Clique sur **Informations complémentaires**,
   - puis sur **Exécuter quand même**.
3. L'installation se fait toute seule en quelques secondes, et l'app s'ouvre.

### Sur Mac

1. Double-clique sur le fichier `.dmg` téléchargé.
2. Dans la fenêtre qui s'ouvre, **glisse l'icône Pasen Capture sur le dossier
   Applications**.
3. Ouvre **Pasen Capture** depuis tes Applications. La première fois, le Mac
   refuse de l'ouvrir, pour la même raison que sur Windows (l'app n'est pas
   signée). Pour l'autoriser :
   - ouvre **Réglages Système** → **Confidentialité et sécurité**,
   - descends jusqu'au message sur Pasen Capture et clique sur **Ouvrir quand même**,
   - confirme avec ton mot de passe ou Touch ID.

Tu n'auras à faire ça qu'une fois.

---

## 3. Relier ton PC à Pasen

L'app doit savoir à quel groupe envoyer tes parties. Pour ça, il te faut un
**code de liaison**.

1. **Demande un code** à la personne qui gère le site (elle le crée en
   10 secondes, voir la [section 6](#6-pour-la-personne-qui-gère-le-site)).
   Il ressemble à `pasen_Xk2…` et c'est une longue suite de caractères.
2. Dans Pasen Capture, colle le code dans la case sous **Link this PC**.
3. Clique sur **Link**.

C'est bon quand tu vois en haut à droite de l'app le nom de ton PC et
**ARIGAFION**.

**Ce code est-il dangereux à partager ?** Il ne peut faire **qu'une seule chose** :
envoyer des parties à votre groupe. Il ne donne accès à aucun compte, ni Riot ni
autre. Il est rangé chiffré sur ton ordinateur, et il peut être désactivé à tout
moment depuis le site.

**Dernière chose, conseillée :** coche **Start with my computer** en bas de
l'app. Elle se lancera toute seule avec ton ordinateur, et tu n'auras plus jamais
à y penser.

---

## 4. Jouer et envoyer tes parties

### Pendant la partie

Tu n'as rien à faire. L'app tourne en arrière-plan :

- **Sur Windows**, son icône (un petit losange doré) est près de l'horloge, en bas
  à droite. Si tu ne la vois pas, clique sur la petite flèche **^**.
- **Sur Mac**, elle est dans la barre de menus, en haut à droite de l'écran.

Quand tu es en jeu, l'app affiche **In game** avec un point rouge, ton champion et
ton score.

### À la fin de la partie

1. Une notification **« Game captured »** apparaît. Clique dessus, ou sur
   l'icône de l'app, pour l'ouvrir.
2. Ta partie est en haut de la liste, avec ton champion, ton score et
   **Victory** ou **Defeat**.
3. Si tu veux, donne-lui un nom dans la case **Name it**, par exemple
   « Finale du vendredi ».
4. Clique sur **Send to Pasen**.

C'est en ligne. Le bouton devient **Open on Pasen** : clique dessus pour voir la
partie sur le site, avec le tableau des scores et le classement des victoires.

### Ce que l'app enregistre (et ce que tu dois envoyer)

L'app enregistre **toutes** tes parties, **ranked comprises** : de l'intérieur
d'une partie, League les présente exactement comme une custom, et l'app ne peut
pas faire la différence. C'est pour ça qu'elle **n'envoie jamais rien sans ton
clic**.

| La partie était… | Ce que tu fais |
|---|---|
| Une **custom entre vous** | **Send to Pasen** |
| Une **ranked** ou une **normale** | **Ignore** (elle est déjà sur Pasen) |
| Une partie **contre des bots** | Comme tu veux. Elle est marquée **vs bots** et ne compte pas dans les stats |

---

## 5. Questions fréquentes et soucis

**L'app affiche toujours « Waiting for a game » alors que je joue.**
Elle ne voit la partie qu'une fois que tu es **dans la partie** elle-même, pas
dans le salon ni pendant la sélection des champions. Attends le chargement. Si
rien ne change une fois en jeu, quitte l'app (clic droit sur son icône →
**Quit**) puis rouvre-la.

**J'ai fermé la fenêtre, l'app est partie ?**
Non, elle continue de surveiller depuis son icône près de l'horloge. Pour la
fermer pour de bon : clic droit sur l'icône → **Quit**.

**L'envoi a échoué.**
Rien n'est perdu : chaque partie est gardée sur ton ordinateur **avant** d'être
envoyée. Vérifie ta connexion, puis clique sur **Try again**.

**« That code was not accepted ».**
Le code a été mal copié, ou il a été désactivé depuis le site. Redemande un
code et colle-le à nouveau.

**J'ai envoyé une ranked par erreur.**
Pas grave. Préviens la personne qui gère le site : elle peut la supprimer.

**La partie affiche « No result ».**
L'app a été fermée, ou le jeu a quitté, juste avant l'écran de fin. La partie est
quand même enregistrée ; la personne qui gère le site peut indiquer qui a gagné
directement sur la page de la partie.

**Est-ce que c'est autorisé ? Je risque quelque chose ?**
L'app lit uniquement les informations que le client League met lui-même à
disposition des outils tiers pendant une partie, sur ton propre ordinateur. C'est
la même source que les overlays de stats bien connus. Elle ne touche à aucun
fichier du jeu, ne lit pas la mémoire du jeu et ne modifie rien.

**Qu'est-ce que l'app garde sur mon ordinateur ?**
Tes parties capturées et le code de liaison (chiffré), dans le dossier de l'app.
Elle n'envoie rien d'autre que les parties sur lesquelles tu cliques
**Send to Pasen**.

**Comment la désinstaller ?**
- **Windows** : Paramètres → Applications → **Pasen Capture** → Désinstaller.
- **Mac** : quitte l'app, puis glisse **Pasen Capture** de tes Applications vers
  la Corbeille.

---

## 6. Pour la personne qui gère le site

Tout se passe sur [aspenne.tech/admin](https://aspenne.tech/admin), une fois
connecté.

**Donner un code à quelqu'un**
1. Carte **Capture app** → écris le nom du PC (par exemple « PC de Nøah »).
2. Clique sur **Pair this PC**, puis **Copy**.
3. Envoie le code à la personne, en message privé.

Le code ne s'affiche **qu'une seule fois**. S'il est perdu, il suffit d'en créer
un nouveau.

**Couper l'accès d'un PC** : dans la même carte, clique sur la corbeille à côté
de son nom. Il ne pourra plus rien envoyer.

**Corriger une partie** : sur la page de la partie (Customs → la partie), un
crayon à côté du titre permet de la renommer, et la barre **Who won?** permet de
choisir l'équipe gagnante.

**Supprimer une partie** : carte **Custom games** de l'admin, corbeille à côté de
la partie.

---

## Pour les développeurs

```bash
cd apps/capture
npm install
npm start          # lance l'app
npm test           # surveillance des parties, stockage, client du site
npm run dist:mac   # construit un .dmg en local
```

L'app est en Electron. Elle interroge l'API Live Client du client League sur
`https://127.0.0.1:2999` (certificat auto-signé par Riot, vérification désactivée
pour cette seule adresse) et envoie les parties à `/api/capture/customs` avec le
code de liaison en jeton `Bearer`.

Ce dossier a son propre `package-lock.json` et est exclu de l'espace de travail
pnpm : electron-builder empaquette `node_modules` tel qu'il le trouve, et la
structure en liens symboliques de pnpm est ce qu'il gère le moins bien.

Les installateurs Windows et macOS sont construits sur GitHub, chacun sur son
propre système (`.github/workflows/capture-app.yml`). Pousser un tag
`capture-v*` publie une nouvelle version.

L'ancien agent en ligne de commande (`apps/agent/agent.mjs`) existe toujours et
produit le même fichier, à uploader à la main dans l'admin.

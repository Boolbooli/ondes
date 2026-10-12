# Ondes

Vos radios en direct, telles qu'elles sont diffusées. Ondes est une application web pour iPhone, à installer depuis Safari : elle lit les flux officiels des stations sans y ajouter de publicité et sans jamais couper une émission.

[English summary below](#english)

## Pourquoi Ondes

Beaucoup d'applications de radio gratuites se financent en glissant leurs propres annonces dans l'écoute, parfois au milieu d'une émission. Ondes ne fait rien de cela : elle lit le flux de la station tel quel, ne collecte aucune donnée et n'a pas de serveur à elle.

Ce que vous entendez ne dépend donc que de la station. Le lecteur l'indique sous chaque station, et le contrôle des flux (`npm run check:streams`) le vérifie : il cherche des segments publicitaires et des serveurs d'insertion sur le chemin de chaque flux.

| Stations | Publicité |
|---|---|
| FIP et ses webradios, webradios de France Musique, Radio Courtoisie, Radio Swiss Jazz, Radio Swiss Classic, BR-Klassik, Radio Paradise, BBC Radio 6 Music, SomaFM | Aucune. |
| France Inter, franceinfo, France Culture, France Musique, Mouv', ici Paris, RTL, TSF Jazz, Jazz24, WWOZ, KEXP | À l'antenne, comme à la FM. Ondes n'ajoute ni ne coupe rien. |
| Europe 1 | Insérée par la station dans son flux internet, côté serveur (AdsWizz). Aucun lecteur ne peut la retirer : le lecteur Ondes le signale. |
| RFI Monde, Venice Classic Radio, NTS 1 et 2 | Non vérifiée. |

RTL est lue depuis son signal de diffusion (HLS), avec 4 heures de rembobinage. Son flux Icecast, qui insère ses propres annonces, est volontairement écarté.

## Installer sur l'iPhone

1. Ouvrez l'adresse de l'app dans **Safari** : `https://<votre-compte>.github.io/ondes/`.
2. Touchez **Partager** (ou **⋯**, puis Partager), choisissez **Sur l'écran d'accueil**, puis **Ajouter**.
3. Ouvrez Ondes depuis son icône : elle s'affiche en plein écran, comme une app.

Pour équiper un proche, **Réglages › Partager ma ligne** envoie un lien : il retrouvera vos stations sur son iPhone.

Les mises à jour arrivent seules. Ondes télécharge la nouvelle version en arrière-plan et propose « Mettre à jour » sans couper l'écoute ; **Réglages › Rechercher une mise à jour** vérifie à la demande.

## Ce que fait Ondes

- **Le plan.** Les stations sont des arrêts sur des lignes colorées : Radio France, FIP, France Musique, Info & débats, Jazz & classique, Monde. « Ma ligne » réunit vos favorites, dans l'ordre que vous choisissez.
- **Une touche pour écouter.** La dernière station reprend d'une touche. La lecture se pilote aussi depuis l'écran verrouillé, les écouteurs et AirPlay.
- **Le rembobinage de RTL.** Jusqu'à 4 heures en arrière, puis retour au direct.
- **À l'antenne.** L'émission ou le titre en cours, et ce qui suit, pour Radio France, KEXP, SomaFM et NTS.
- **La recherche.** Dans le réseau et dans [Radio Browser](https://www.radio-browser.info), annuaire libre de dizaines de milliers de radios. Vous pouvez aussi coller l'adresse d'un flux, y compris une liste M3U ou PLS.
- **La minuterie.** Arrêt après 15 à 90 minutes, ou à la fin de l'émission quand son horaire est connu.
- **La qualité du son.** Haute fidélité, ou Économie pour la 4G et la 5G.
- **La fiabilité.** Sources de secours par station, reconnexion automatique (« Trafic perturbé ») et reprise au retour du réseau.
- **L'apparence.** Thème Émail (sombre) ou Carrelage (clair), en français ou en anglais.

## Limites

- Europe 1 insère ses publicités dans son flux internet (voir plus haut).
- Pas d'app CarPlay dédiée : seulement l'écran « À l'écoute ».
- Le volume se règle avec les boutons de l'iPhone : iOS n'en donne pas le contrôle aux apps web.
- Flux en https uniquement : l'iPhone ne lit pas de flux http dans une app sécurisée.
- « À l'antenne » ne couvre que Radio France, KEXP, SomaFM et NTS : les autres stations ne publient pas de données ouvertes, et une app web ne peut pas lire les titres glissés dans le flux (ICY).
- Le rembobinage n'existe que là où la station le permet (RTL).

## Entretien

Tout tient dans ce dépôt : pas de serveur, pas de base de données, pas de compte.

### Ajouter ou modifier une station

1. Modifiez `src/data/stations.ts` : nom, ligne, pays, accroche, flux, données « À l'antenne » et publicité de chaque station.
2. Lancez `npm run art` : il régénère les plaques, icônes et écrans de lancement dans `public/`. Validez-les avec le code.
3. Lancez `npm run check:streams -- <id>` : il vérifie les flux de la station, son rembobinage, ses données « À l'antenne » et sa publicité.
4. Poussez sur `main` : GitHub Actions teste puis publie en quelques minutes, et les iPhone proposent la mise à jour.

### Le contrôle hebdomadaire

Chaque lundi, le workflow « Vérifier les flux » écoute toutes les stations. S'il échoue, une station n'a plus aucun flux qui fonctionne : GitHub vous envoie un e-mail, et le résumé de l'exécution dit laquelle. Les avertissements, comme une source de secours en panne, ne le font pas échouer.

- Les serveurs de GitHub sont aux États-Unis. Si un flux échoue là-bas mais fonctionne chez vous, lancez `npm run check:streams` sur votre ordinateur.
- GitHub suspend les tâches planifiées après 60 jours sans activité sur un dépôt public. Pour les relancer, ouvrez l'onglet Actions et touchez « Enable workflow ».

## Développement

Prérequis : Node.js 24 (voir `.nvmrc`), et Microsoft Edge pour les tests de bout en bout.

| Commande | Rôle |
|---|---|
| `npm ci` | Installer les dépendances verrouillées. |
| `npm run dev` | Serveur de développement, joignable depuis l'iPhone sur le même Wi-Fi. |
| `npm test` | Tests unitaires (Vitest, happy-dom). |
| `npm run test:e2e` | Tests de bout en bout (Playwright, profil iPhone 15 ; Edge en local, Chrome sur GitHub). |
| `npm run check` | Types, tests unitaires et build de production. |
| `npm run build`, puis `npm run preview` | Essayer la version de production. |
| `npm run art` | Régénérer les visuels de `public/`. |
| `npm run check:streams` | Vérifier tous les flux ; `-- -v` détaille chaque contrôle. |

```text
src/core/      lecture (hls.js, Icecast), sources, Media Session, « À l'antenne », annuaire, stockage
src/state/     état de l'app (signals Preact)
src/ui/        composants Preact
src/styles/    CSS par zone ; les jetons de design sont dans tokens.css
src/data/      lignes et stations
scripts/       génération des visuels, contrôle des flux
tests/         unit/ (Vitest), e2e/ (Playwright), fixtures/ (réponses réelles des API)
```

Le produit est décrit dans [PRODUCT.md](PRODUCT.md), l'identité visuelle dans [DESIGN.md](DESIGN.md).

## Publier (une seule fois)

1. Créez un dépôt **public** nommé `ondes` sur votre compte GitHub personnel. GitHub Pages est gratuit pour les dépôts publics, et l'app ne contient aucun secret.
2. Poussez ce dossier :

   ```sh
   git remote add origin https://github.com/<votre-compte>/ondes.git
   git push -u origin main
   ```

3. Dans le dépôt, ouvrez **Settings › Pages** et choisissez la source **GitHub Actions**. Avec GitHub CLI, connecté à ce compte : `gh api -X POST repos/<votre-compte>/ondes/pages -f build_type=workflow`.
4. Dans l'onglet **Actions**, ouvrez « Vérifier et publier » et lancez **Run workflow**. L'app est en ligne quelques minutes plus tard à `https://<votre-compte>.github.io/ondes/`.

## Crédits

- Données « À l'antenne » : Radio France, KEXP, SomaFM et NTS. Annuaire : Radio Browser.
- Polices Archivo et Doto (SIL Open Font License), via Fontsource. Lecture HLS : hls.js. Interface : Preact.
- Les plaques des stations sont des créations typographiques, pas des logos officiels. Les noms des stations appartiennent à leurs propriétaires ; Ondes est un lecteur indépendant, sans lien avec elles.

## English

Ondes is an installable web app for iPhone. It plays radio stations' official live streams exactly as broadcast: it adds no ads, never cuts a programme and collects no data. Stations are stops on coloured metro lines, and your favourites form "Ma ligne" (My line).

- **Install:** open the app's address in Safari, tap Share, then Add to Home Screen. Settings › Share my line sends your stations to someone else's iPhone. Updates install in the background and are offered without interrupting playback.
- **Ads:** what you hear comes from the station. FIP, the Radio France web radios and Radio Courtoisie air none. France Inter, RTL and others air their own breaks, as on FM. Europe 1 inserts ads into its internet stream on the server (AdsWizz), which no player can remove; the player says so, and shows where the ads come from for every station.
- **RTL** plays from its broadcast HLS feed, with 4 hours of rewind. Its Icecast stream, which inserts its own ads, is left out.
- **Maintain:** edit `src/data/stations.ts`, run `npm run art` and `npm run check:streams -- <id>`, then push to `main`. GitHub Actions tests the app and deploys it to GitHub Pages. A weekly workflow checks every stream and GitHub emails you if a station has no working source left.
- **Develop:** Node.js 24, `npm ci`, `npm run dev`, `npm test`, `npm run test:e2e` (Playwright with Edge locally, Chrome on CI), `npm run check`.
- **Limits:** no dedicated CarPlay app (Now Playing only), volume through the iPhone's buttons, HTTPS streams only, and now-playing data for Radio France, KEXP, SomaFM and NTS only.

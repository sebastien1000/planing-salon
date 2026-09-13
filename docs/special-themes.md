# Thèmes événementiels automatiques

## Configuration

Dans `js/themes/theme-config.js`, compléter uniquement les nombres de :

```js
var MARION_BIRTHDAY = { day: 20, month: 3 };
var JULIIE_BIRTHDAY = { day: 20, month: 6 };
```

`day` est le jour (1–31), `month` le mois (1–12). Une valeur `null` laisse
l'anniversaire désactivé. Juliie : 20 juin, date confirmée par l’utilisateur.
Marion : 20 mars, date confirmée par l’utilisateur.
Chaque anniversaire dure quatre jours civils : du 20 au 23 mars inclus pour
Marion et du 20 au 23 juin inclus pour Juliie. Le thème habituel revient le 24.
La constante `BIRTHDAY_DURATION_DAYS = 4` définit cette durée, jour anniversaire
inclus. Le 29 février ne déclenche une période que les années bissextiles.
Une date impossible ne s’active pas.

Dans le même fichier, `SPECIAL_THEMES` contient les périodes, priorités,
décorations, messages et `hiddenFromThemeSelector` :

- Saint-Valentin : du 12 au 15 février inclus (`start` / `end`).
- Pâques : de J−2 à J+1 inclus (`easter.daysBefore` / `daysAfter`).
  Dimanche calculé selon le calendrier grégorien, chaque année.
- Anniversaires : du jour exact à J+3 inclus (`durationDays`).

Les dates suivent le fuseau local de l'appareil, comme les saisons existantes.
Une modification du fichier nécessite de republier le site ou de reconstruire
l'application Android. Les dates restent configurées dans le code ; aucun droit de modification des dates n’est ajouté.

## Activation et persistance

L'ancien mécanisme reste la base : chaque nouvelle saison active son thème une
fois par compte (`lastSeasonalActivationId`). Un choix manuel le remplace ensuite
jusqu'à la saison suivante. Cette version n'a pas de commutateur Auto/Manuel
distinct. Halloween conserve sa période du 20 octobre au 1er novembre inclus.

Les événements cachés remplacent temporairement cette base sans être sauvegardés
dans `selectedTheme`. Priorités : anniversaire (600), Saint-Valentin (500),
Pâques (400), Halloween (300), autres saisons (200), choix de base/default.
Les saisons déterminent la base selon le mécanisme existant ; elles ne réimposent
pas leur thème après un choix manuel pendant la même saison.
En cas d'anniversaires simultanés, Marion gagne (ordre stable de configuration).
Un choix manuel pendant un événement est conservé et visible à sa fin.
Si une nouvelle saison commence pendant un anniversaire, elle actualise la base.

Le calcul se fait à l'ouverture, à minuit local, au retour de visibilité, au focus
et au retour PWA (`pageshow`). Aucun événement caché ne figure dans les options,
et `setTheme` refuse ces identifiants, y compris pour l’administrateur.
Le profil administrateur retrouve les quatre thèmes dans Plus > Apparence, dans la même grille
« Thèmes saisonniers · Administrateur » que Halloween et Noël. Leurs boutons appliquent
un aperçu temporaire uniquement sur cette page, avec « Terminer l’aperçu ».
L’aperçu ne survit pas au rechargement et n’est jamais enregistré ni synchronisé.
La vérification du compte et du rôle existant est aussi effectuée dans le moteur.
Les collaboratrices ne voient pas ces boutons et ne peuvent pas utiliser l’API
d’aperçu. Le réglage des animations reste applicable.
Les préférences persistantes reçues sont également filtrées.
Aucune migration ni modification des accès Supabase.

## Rendu et contrôles

Les quatre décors utilisent désormais exactement l’ancrage de la citrouille
Halloween : `#theme-decorations::before`, fixé en bas à droite au-dessus des
onglets. Les dimensions, marges et adaptations tablette sont celles du sélecteur
commun aux thèmes illustrés. Le calque reste à z-index 6, sous les onglets (8),
le bouton + (9) et les modales (20), avec `pointer-events: none`.

Les anniversaires affichent les ballons et cadeaux, Saint-Valentin les cœurs et
roses, Pâques les œufs et fleurs. Les images WebP sur fond neutre sont fusionnées
avec le fond par CSS (multiply pour les thèmes clairs, screen pour Marion).
Marion utilise une palette violet, lilas et argent, avec une illustration assortie
(`assets/img/themes/special/anniversaire-marion-violet.webp`).
L’animation est celle d’Halloween (`halloween-breathe`, 5,8 secondes).
Les anniversaires affichent 12 confettis, 12 ballons, 4 cœurs et 3 étoiles (31 éléments).
Saint-Valentin affiche 12 cœurs, 12 pétales et 3 étoiles (27 éléments). Les ballons
descendent lentement, les confettis et cœurs tombent avec des départs décalés.
Pâques affiche 12 œufs, 12 fleurs et 2 pétales (26 éléments). Le réglage animations
OFF et `prefers-reduced-motion` arrêtent les mouvements, sans retirer les décors.

Les grandes scènes et espaces réservés dans l’en-tête et dans la carte Apparence
ont été supprimés à la demande de l’utilisateur. L’aperçu administrateur affiche
le même décor fixé en bas à droite. Les messages anniversaire restent discrets.
Le placement fixe peut passer visuellement devant le contenu lors du défilement,
comme Halloween ; il n’intercepte aucun clic. Les contrôles navigateur utilisent
des rendez-vous fictifs et ne remplacent pas un essai du planning réel.

Les assets sont dans `assets/img/themes/special/`, embarqués dans le build Android
et précachés par le service worker. Les anciennes variantes sont archivées dans
`output/themes/archive/`, hors build.

Tests : `npm test` (ou exécution directe avec
`node tests/special-themes.test.js` pour le détail des cas).
Build web Android : `npm run build:android-assets`.

À contrôler sur Android, iPad/PWA, tablette et desktop : vues jour/semaine/mois,
lecture des rendez-vous et horaires, ouverture du burger et des modales, bouton +,
absence de débordement horizontal, portrait/paysage, réglage animations et réduction
des mouvements, reprise après veille au changement de jour. Tester les dates sur
une copie locale avec des dates fictives pour les anniversaires, sans ajouter
un déclencheur dans l'application livrée.

## Organisation du code

- `theme-config.js` : priorités nommées (`THEME_PRIORITIES`), listes saisonnières
  et permanentes, dates et registre des événements. `specialThemeById` est utilisé
  par le moteur et les contrôles d’aperçu.
- `seasonal-theme-resolver.js` : calcul des dates et choix du thème prioritaire.
  La recherche de saison parcourt le calendrier sans le trier ni le modifier.
- `theme-manager.js` : résolution du thème courant, application au DOM et
  synchronisation des préférences. L’aperçu reste temporaire et réservé à l’admin.
- `premium-scenes.css` : une référence d’image par thème, partagée avec sa vignette.
  Les messages anniversaire proviennent de la configuration JavaScript.

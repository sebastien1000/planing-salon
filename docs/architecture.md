# Organisation du code

L’application reste en HTML, CSS et JavaScript natif. Cette réorganisation ne
change ni le modèle de données, ni les droits, ni la logique des rendez-vous.

## Styles

- `css/base.css` : valeurs par défaut, normalisation et typographie de base.
- `css/layout.css` : structure de l’application, navigation, modales et safe areas.
- `css/components.css` : point d’entrée des composants réutilisables.
- `css/components/common.css` : cartes, boutons, badges et statistiques partagés.
- `css/components/forms.css` : champs et cases à cocher.
- `css/components/profiles.css` : avatars et présentation des collaboratrices.
- `css/components/reservations.css` : conflits et validation des formulaires de rendez-vous.
- `css/components/services.css` : sélection et administration des prestations.
- `css/pages.css` : quelques règles communes aux pages.
- `css/pages/<page>.css` : feuille propre à chaque page HTML. Les pages sans
  règles spécifiques importent seulement les règles partagées ; il n’est pas
  nécessaire de créer des styles artificiels pour remplir leur fichier.
- `css/pages/auth.css` : styles partagés entre connexion et réinitialisation.
- `css/pages/planning.css` : grilles jour/semaine/mois et blocs du planning.
- `css/pages/plus.css` : sélecteur de thèmes et aperçus administrateur.
- `css/pages/fiche-caisse.css` : styles de caisse et impression.

Chaque thème illustré possède **un fichier `css/themes/<id>.css`** avec sa
palette, sa vignette et sa scène spécifique. Par exemple :
`anniversaire-marion.css`, `anniversaire-juliie.css`, `saint-valentin.css`,
`paques.css` et `halloween.css`.

`css/themes/catalog.css` importe les 18 thèmes. Les règles réellement communes
restent dans `theme-vars.css` (adaptation des composants),
`animations-common.css` (mouvements et réduction des animations),
`theme-effects.css` (particules) et `premium-scenes.css` (composition des scènes).
Le thème par défaut utilise les valeurs de `base.css`.

L’ordre des feuilles dans les HTML est volontaire : base, structure, composants,
page, puis moteur de thèmes. Le catalogue est importé avant les règles communes
finales des scènes, qui fixent notamment leur placement responsive.

## JavaScript

- `js/pages/` orchestre le chargement et le rendu de chaque page.
- `js/ui/appearance-card.js` expose `SalonAppearanceCard.render(user)` et
  `bind(user)`. Les aperçus et les restrictions administrateur sont conservés.
- `js/ui/settings-card.js` expose `SalonSettingsCard.create()`, qui renvoie
  `render()` et `bind()`. L’instance conserve les réglages et utilise le stockage existant.
- `js/themes/` conserve la configuration, le calendrier, la résolution des
  priorités, les préférences, les décorations et l’application du thème.
- `js/core/form-*.js` conserve les formulaires séparés par métier.
- `js/core/forms.js` reste leur façade commune.
- `js/core/domain.js` contient les calculs partagés, indépendants du DOM.
- Les modules existants de données et d’authentification restent inchangés par
  cette réorganisation.

Les dates et priorités des événements restent dans `js/themes/theme-config.js`.
Les CSS ne contiennent aucune logique d’activation.

## Fichiers embarqués et PWA

`scripts/app-files.js` est la source commune de la liste des pages et répertoires
embarqués. Le build Android et la génération du précache l’utilisent tous deux.

Après une modification des fichiers applicatifs :

```sh
npm run sync:pwa
npm test
npm run check:pwa
npm run build:android-assets
```

`sync:pwa` recense les fichiers, écrit `APP_ASSETS` dans `sw.js` et calcule la
version de cache à partir de leur contenu et du code du service worker.
Ne pas modifier manuellement cette liste ni son numéro de version.
Le comportement réseau du service worker reste inchangé.
Le build Android copie les fichiers dans `www/` ; il ne compile pas un APK.

## Vérifications de la réorganisation

Les tests couvrent les ressources HTML, les imports CSS et leurs cycles, les
images référencées, les fichiers par thème, la syntaxe JavaScript et les réglages.
Les tests des thèmes et des absences restent présents.

Une comparaison navigateur avant/après a contrôlé 289 674 valeurs de styles
sur des composants représentatifs, pour 19 variantes de thème aux largeurs
360, 768 et 1200 px, sans différence. Ce contrôle utilise des données fictives,
pas une session authentifiée. Il ne remplace pas un essai du planning connecté,
des formulaires et de la PWA sur Android/iPad après déploiement.

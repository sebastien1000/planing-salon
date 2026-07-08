# Planning Salon

Application web statique pour gerer un planning de salon, les clientes, les comptes collaboratrices, la recherche et quelques outils internes.

## Apercu

Le projet fonctionne sans backend.
Toutes les donnees sont stockees dans le navigateur via `localStorage`.

Pages principales :

- `index.html` : connexion
- `planning.html` : planning des rendez-vous
- `clients.html` : fiches clientes
- `recherche.html` : recherche de rendez-vous
- `comptes.html` : comptes et statistiques
- `plus.html` : prestations, mes absences (et celles de l'equipe pour l'admin), photo, reinitialisation

## Lancer le projet

Comme il y a un `service worker`, il faut utiliser un serveur local HTTP et ne pas ouvrir les fichiers directement avec `file://`.

Exemple :

```bash
python3 -m http.server 8000
```

Puis ouvrir :

```text
http://localhost:8000
```

## Comptes de demo

- `Julie` / `demo`
- `Marion` / `demo`
- `admin` / `demo`

## Structure

```text
css/
  base.css
  layout.css
  components.css
  pages.css
js/
  core/
  pages/
```

- `js/core/` contient la logique partagee
- `js/pages/` contient la logique de chaque ecran

## Gestion des collaborateurs

Depuis l'espace admin (page Comptes), un administrateur peut creer, modifier ou supprimer un collaborateur : nom, identifiant, mot de passe, role (admin ou collaborateur), couleur d'affichage dans le planning, salles autorisees et prestations autorisees.

- si aucune salle ou prestation n'est cochee lors de la creation, le compte n'a aucune restriction
- si toutes les cases sont decochees volontairement, le compte n'a plus aucun acces (a corriger depuis le formulaire)
- la suppression est bloquee si le compte a des rendez-vous a venir, et il doit toujours rester au moins un administrateur
- un compte peut etre desactive au lieu d'etre supprime : il ne peut plus se connecter ni recevoir de nouveaux rendez-vous, mais ses rendez-vous existants restent geres normalement

## Conges et absences

- **Conges** (page Comptes, bouton "Conges" sur une fiche collaborateur) : geres uniquement par l'admin, plage de dates/heures, motif (vacances, conge, formation, autre). Toujours visibles en detail par toute l'equipe.
- **Absences** (page Plus) : chaque collaborateur cree, modifie et supprime ses propres absences (maladie, rendez-vous personnel, formation, urgence, indisponibilite, autre). L'admin voit et gere celles de tout le monde. Les autres collaborateurs voient qu'un creneau est bloque mais pas le motif.
- Dans les deux cas, un rendez-vous ne peut pas etre enregistre sur une periode couverte par un conge ou une absence : le planning verifie la date, l'heure de debut et l'heure de fin.

## Stockage local

Les donnees sont stockees sous la cle `salonMvpV4`.

Contenu principal :

- utilisateurs
- prestations
- clientes
- reservations
- absences
- photos

## Point important

Les photos peuvent prendre beaucoup de place dans `localStorage`.
Le projet inclut maintenant une protection : si le stockage local est plein, les photos sont supprimees automatiquement pour eviter que l'application ne plante au chargement.

## Depannage

Si une page reste vide :

1. Recharge la page completement.
2. Ferme et rouvre le navigateur.
3. Supprime les donnees du site si un ancien cache persiste.
4. Recharge ensuite `index.html`.

Si le navigateur garde une ancienne version :

1. Ouvre les outils de developpement.
2. Desinstalle le service worker du site.
3. Recharge la page.

## Bonnes pratiques pour continuer

- garder les fichiers `js/core/` petits et specialises
- eviter de stocker de grosses images dans `localStorage`
- tester les pages via un serveur local
- incrementer la version du cache dans `sw.js` apres une modification importante
- documenter chaque changement important dans ce `README`

## Documentation projet

- voir `CHANGELOG.md` pour l'historique recent
- voir `MAINTENANCE.md` pour les controles et procedures de maintenance

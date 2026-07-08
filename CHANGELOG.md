# Changelog

## 2026-07-08 (4)

### Ajoute

- menu "☰ Salles" sur la page Planning : liste les 5 salles avec leur statut (Libre / Reservee / Occupee maintenant) pour le jour affiche, sans surcharger l'ecran principal
- pour une salle non libre : collaborateur et horaire du creneau, avec la meme regle de confidentialite que le reste du planning (details prives masques aux autres collaborateurs)

## 2026-07-08 (3)

### Corrige

- les cartes collaborateur/administrateur (page Comptes) n'affichent plus que 2 boutons (Modifier, Plus d actions) au lieu de 4 a 6 : les actions secondaires (conges, reinitialiser mot de passe, lien de reinitialisation, activer/desactiver, supprimer) sont regroupees dans un panneau "Plus d actions", sans perte de fonctionnalite

## 2026-07-08 (2)

### Ajoute

- gestion des conges/vacances par l'admin : creation, modification, suppression, plage de dates et heures, motif (vacances, conge, formation, autre)
- gestion des absences par chaque collaborateur pour son propre compte (maladie, rendez-vous personnel, formation, urgence, indisponibilite, autre), avec vue et gestion complete pour l'admin
- profil collaborateur etendu : telephone, email, photo de profil (redimensionnee automatiquement avant stockage)
- activation/desactivation d'un compte par l'admin (bloque la connexion et les nouvelles reservations, garde les rendez-vous existants intacts)

### Corrige

- le planning verifie desormais une vraie plage de dates/heures pour les conges et absences (avant : un seul jour, sans heure de fin) avant d'autoriser un rendez-vous
- un compte desactive est deconnecte automatiquement s'il etait deja connecte

## 2026-07-08

### Ajoute

- gestion complete des collaborateurs cote admin : creation, modification, suppression
- role (admin ou collaborateur), couleur d'affichage, salles autorisees et prestations autorisees par compte
- verification automatique qu'une collaboratrice ne peut pas etre assignee a une salle ou une prestation qui ne lui est pas autorisee
- garde-fou pour toujours garder au moins un compte administrateur

### Corrige

- la suggestion automatique de salle et le conflit de salle ne dependent plus des noms "Julie"/"Marion" ecrits en dur, ils sont desormais generiques pour n'importe quel collaborateur

## 2026-07-07

### Ajoute

- ajout de `README.md`
- ajout de `.gitignore`
- ajout de `.editorconfig`
- ajout d'une instruction de langue dans `AGENTS.md`

### Corrige

- protection du chargement des donnees si `localStorage` est plein
- suppression automatique des photos stockees si elles bloquent la sauvegarde
- mise a jour de la version du cache du service worker

### Notes

- si une ancienne version du site reste en cache, recharger completement la page
- en cas de doute, supprimer le cache du site et reouvrir l'application

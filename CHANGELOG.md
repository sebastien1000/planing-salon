# Changelog

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

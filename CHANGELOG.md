# Changelog

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

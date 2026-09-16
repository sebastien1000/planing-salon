
# Workflow Git automatique

Pour chaque nouvelle demande de modification du projet, utilise automatiquement le skill git-auto-flow.

Règles :
- crée une branche dédiée avant de modifier
- ne travaille pas directement sur main, master, dev ou production
- fais git add uniquement des fichiers utiles
- fais un commit propre avec un message adapté
- fais un git push de la branche
- explique toujours les commandes utilisées
- ne fais jamais git push --force sans accord
- ne supprime jamais les modifications existantes sans accord

## Après chaque push sur main (déploiement)
- Une fois une branche mergée dans main : déployer automatiquement sur Vercel en production (`vercel --prod`), en confirmant explicitement avant le déploiement prod.
- Puis lancer le build Android (`npm run build:android`) et indiquer où se trouve l'APK généré (`android/app/build/outputs/apk/debug/app-debug.apk`).
- Ces deux étapes sont désormais automatiques après un merge, sans qu'il soit nécessaire de le redemander à chaque fois.

## Sécurité Supabase
- La clé `anon` est publique : la sécurité repose uniquement sur les droits SQL et la RLS.
- Aucun droit pour le rôle `anon` sur les tables et les vues.
- Toute vue recréée (`drop view` + `create view`) doit être suivie de `revoke all on <vue> from anon;` (une vue recréée reçoit à nouveau les droits par défaut).
- Préférer `create or replace view` à `drop` + `create` quand c'est possible.
- Les règles RLS utilisent `is_active_staff()` / `is_admin()`, jamais seulement `auth.uid() is not null`.
- Les vues `reservations_public` et `blocked_periods_public` contournent la RLS : elles doivent garder `where is_active_staff()`.
- Personne ne modifie son propre rôle ni son statut `active`.
- Une nouvelle collaboratrice est inactive jusqu'à validation par l'admin (page Comptes → Réactiver).
- Un nouvel admin ajouté via "Ajouter un collaborateur" atterrit aussi inactif à sa première connexion (le rôle demandé est conservé, jamais forcé à collab) : seul un admin existant peut l'activer, jamais `validate_collaborator()` qui reste limitée à role='collab'.
- Jamais la clé `service_role` dans le code du site.
- Après chaque migration : vérifier Supabase Advisors (Security).
- Détails : `supabase/migrations/2026-09-16_security_hardening.sql`, `supabase/migrations/2026-09-16_profiles_pending_admin_role.sql`.

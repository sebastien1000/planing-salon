# Sauvegarde pre-Android - Planning Salon

Ce document fige l'etat stable du projet avant de commencer la transformation en application Android (Capacitor/APK). Il sert de point de reprise si besoin.

## A. Etat du projet

- Nom : Planning Salon
- Application HTML/CSS/JavaScript statique (pas de framework, pas de build)
- Branche stable sauvegardee : `backup/pre-android-stable`
- Branche source : `fix/audit-before-main`
- Etat : fonctionnel en web local, avant toute modification Android

## B. Fonctionnalites validees

- Connexion Supabase Auth
- Deconnexion
- Planning (vues jour/semaine/mois, filtres, statut des salles)
- Clients (fiches, historique, creation automatique depuis une reservation)
- Recherche
- Comptes (gestion des collaborateurs, statistiques)
- Page Plus (prestations, absences/conges)
- Navigation entre pages sans avoir besoin d'actualiser manuellement
- Service worker / cache corrige (reseau d'abord pour HTML/JS, gestion du bfcache)
- RLS clients renforcee dans `supabase/schema.sql` (policies insert/update avec `WITH CHECK`)

## C. Supabase

- Project URL : `https://hzrwswtsawytissojvtw.supabase.co`
- Cle publique utilisee : `sb_publishable_S_NnoON4N0Wfw6Kv8Cz8eg_qYxf_L8F`

**Important :**
- Cette cle est une cle **publique anon/publishable** : elle est concue pour etre visible cote navigateur, ce n'est pas un secret.
- Ne jamais ajouter de cle `service_role` dans ce depot ou dans le code front.
- Ne jamais ajouter de mot de passe dans ce depot.

## D. Tables necessaires

- `profiles`
- `clients`
- `reservations`
- `reservations_public` (vue)

## E. Profils de test / roles attendus

Emails et roles uniquement, **sans mot de passe** (les mots de passe ne sont geres que dans Supabase Authentication) :

- `titiseb76.sb@gmail.com` -> admin
- `titiseb76.sb+julie@gmail.com` -> collab
- `titiseb76.sb+marion@gmail.com` -> collab

## F. Configuration Supabase locale

URLs a garder dans Supabase > Authentication > URL Configuration pour les tests locaux :

- `http://127.0.0.1:5500`
- `http://127.0.0.1:5500/reset-password.html`
- `http://127.0.0.1:5500/*`

## G. Commandes de test local

- Ouvrir le projet avec Live Server sur `http://127.0.0.1:5500`
- Ou lancer un serveur local si besoin : `python3 -m http.server 8000`
- Verifier le login (connexion + deconnexion)
- Verifier le planning (affichage, ajout/modification/annulation d'un RDV)
- Verifier la navigation entre les pages (Planning -> Plus -> Planning, sans avoir a actualiser)

## H. SQL important

- Le fichier `supabase/schema.sql` doit etre relance dans Supabase > SQL Editor si les policies RLS ne sont pas a jour (script idempotent, sans risque de le relancer).
- Ne jamais mettre de mot de passe dans ce fichier.
- Ne jamais utiliser la cle `service_role` cote front.

## I. Ce qu'il ne faut pas casser avant Android

- Supabase Auth
- RLS (regles de securite Postgres)
- Login
- Planning
- Navigation entre les pages
- Service worker
- Route de reinitialisation de mot de passe (`reset-password.html`)

## J. Prochaine etape prevue

- Creer une branche dediee Android : `feat/android-apk`
- Preparer Capacitor
- Creer un dossier `www` propre
- Generer un APK de test

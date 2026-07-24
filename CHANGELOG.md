# Changelog

## 2026-07-24

### Ajoute

- conges et absences des collaborateurs migres vers Supabase (table `blocked_periods`, RLS) : visibles par toute l'equipe, plus jamais coinces sur l'appareil qui les a crees
- chaque collaboratrice peut desormais creer/modifier/supprimer ses propres conges (auparavant reserve a l'admin), comme elle le faisait deja pour ses absences
- chaque collaboratrice peut ajouter une prestation neuve au catalogue et s'y attribuer son propre tarif, en plus de modifier ses prestations existantes (auparavant en lecture seule)
- couleur de profil par collaboratrice, synchronisee via Supabase et appliquee dans tout le planning (RDV pleins/haches, conges/absences) pour reperer d'un coup d'oeil qui a quel rendez-vous
- salle proposee par defaut par collaboratrice (ex. Marion -> Salle Ongles 2), reglable par l'admin, modifiable a tout moment dans le formulaire de RDV
- les stats "Mes RDV affiches"/"Mes termines" du planning sont cliquables (recap detaille), et ne comptent plus que les RDV de la personne connectee
- conges/absences positionnes et dimensionnes dans la grille horaire jour/semaine selon leur vraie duree (au lieu d'une carte texte ne refletant pas l'horaire reel)

### Corrige

- le bandeau du bas (barre d'onglets) disparaissait sur grand ecran/web des que le contenu depassait la hauteur de l'ecran
- mismatch d'identifiant pour les comptes crees via "Ajouter un collaborateur" : bloquait silencieusement tout enregistrement de conge/absence/prestation par la collaboratrice elle-meme (auto-repare a la reconnexion)
- Julie/Marion apparaissaient en double dans les selecteurs de collaboratrice (fiche cliente notamment)
- la fiche cliente n'affichait qu'une seule collaboratrice meme si plusieurs etaient cochees
- la page Recherche n'affichait pas ses resultats par ordre chronologique
- proposition de prochain RDV (apres avoir termine un rendez-vous) : la prestation habituelle ne se preremplissait jamais (appel a une fonction inexistante), et le champ Salle etait en lecture seule sans possibilite de le corriger
- le bouton accueil ne ramenait pas toujours Marion sur la vue mois du planning si elle avait change de vue auparavant

### A configurer

- si ce n'est pas deja fait, executer `supabase/schema.sql` dans Supabase (idempotent, peut etre relance sans risque) pour les nouvelles tables/colonnes (`blocked_periods`, `profiles.color`, `profiles.default_room`, policies `services`)

## 2026-07-08 (7)

### Ajoute

- migration complete des clientes et des rendez-vous vers Supabase (vraie base de donnees) : `supabase/schema.sql` avec Row Level Security, vue `reservations_public` qui masque les donnees privees cote serveur, contrainte anti-double-reservation au niveau base de donnees
- creation/reutilisation automatique de la fiche cliente lors de la prise de RDV (recherche par telephone, email puis nom) - fini les doublons
- fiche cliente enrichie : allergies/precautions, historique des rendez-vous, dernier RDV termine calcule automatiquement
- synchronisation automatique du profil Supabase d'un collaborateur a sa premiere connexion

### Corrige

- plusieurs verifications de securite (suppression de compte, suppression de prestation, avertissement de creneau) lisaient encore l'ancien stockage local des rendez-vous et auraient laisse passer des actions qu'elles étaient censees bloquer
- faille potentielle dans les regles Supabase : un collaborateur aurait pu s'auto-attribuer le role administrateur en modifiant directement sa fiche ; corrige avant toute mise en service

### A configurer

- executer `supabase/schema.sql` dans Supabase (une seule fois) - voir la section "Clientes et rendez-vous (Supabase)" du README

## 2026-07-08 (6)

### Ajoute

- vraie reinitialisation de mot de passe par email via Supabase Auth : lien securise, temporaire, a usage unique, mot de passe hache cote serveur (jamais en JS navigateur)
- page "Mot de passe oublie" sur l'ecran de connexion (message toujours neutre, aucune fuite sur l'existence d'un compte) et nouvelle page `reset-password.html`
- connexion desormais par email (remplace l'identifiant court)

### Corrige

- suppression du faux bouton "Lien reset" (`salon-reset://`, ne faisait rien) et de la fausse reinitialisation admin (mot de passe remis en clair a "demo") : remplaces par un vrai envoi d'email
- les mots de passe ne sont plus stockes du tout dans `localStorage`, meme en clair (nettoyage automatique des anciennes donnees)
- retrait des boutons de connexion demo (reposaient sur un mot de passe partage incompatible avec Supabase)

### A configurer

- voir la section "Authentification (Supabase)" du `README.md` : creer un projet Supabase, renseigner l'URL/cle anon, et creer un compte Supabase par collaborateur

## 2026-07-08 (5)

### Ajoute

- le menu "☰ Filtres" du planning devient un vrai centre de filtres : collaborateur, salle, type d'evenement (RDV / absences / conges-vacances), et filtre salles occupees/libres pour la liste des salles
- boutons "Tout afficher" et "Reinitialiser les filtres"
- resume du filtre actif affiche sur l'ecran principal, sans qu'il soit necessaire d'ouvrir le menu pour savoir ce qui est filtre

### Corrige

- la rangee de chips de salle a ete retiree de l'ecran principal du planning (deplacee dans le menu) pour gagner de la place, comme demande

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

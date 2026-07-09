# Planning Salon

Application web statique pour gerer un planning de salon, les clientes, les comptes collaboratrices, la recherche et quelques outils internes.

## Apercu

L'authentification, les clientes et les rendez-vous sont geres par [Supabase](https://supabase.com) (vraie base de donnees + droits verifies cote serveur). Le reste (comptes/roles, prestations, salles, absences, conges, preferences d'affichage) reste dans `localStorage` du navigateur.

Pages principales :

- `index.html` : connexion
- `planning.html` : planning des rendez-vous
- `clients.html` : fiches clientes
- `recherche.html` : recherche de rendez-vous
- `comptes.html` : comptes et statistiques
- `plus.html` : prestations, mes absences (et celles de l'equipe pour l'admin)

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

## Authentification (Supabase)

La connexion, le mot de passe et sa reinitialisation par email sont geres par [Supabase Auth](https://supabase.com) - plus aucun mot de passe n'est stocke dans ce projet (ni en clair, ni hache).

Configuration a faire une seule fois :

1. Creer un projet gratuit sur supabase.com.
2. Dans Project Settings -> API, recuperer l'URL du projet et la cle publique `anon`. Renseigner ces deux valeurs dans `js/core/supabase-client.js`. Cette cle `anon` n'est pas un secret, elle est faite pour etre publique - ne jamais utiliser la cle `service_role` ici.
3. Dans Authentication -> Email Templates, personnaliser le mail "Reset Password" (le bouton "Reinitialiser mon mot de passe").
4. Dans Authentication -> URL Configuration, autoriser l'URL du site (et `.../reset-password.html`) en Redirect URL.
5. Pour chaque collaborateur : creer un utilisateur Supabase (Authentication -> Users -> Add user) avec le meme email que celui renseigne dans sa fiche (page Comptes), puis lui envoyer un lien de reinitialisation ("Envoyer un lien de reinitialisation" dans son profil) pour qu'il choisisse son propre mot de passe.

Le reset par SMS n'est pas encore branche (necessiterait un fournisseur SMS type Twilio configure dans Supabase, a faire dans un second temps si besoin).

**Limite a connaitre** : un deuxieme compte administrateur ne peut pas se "creer" automatiquement a la premiere connexion (pour empecher qu'un simple collaborateur s'auto-promeuve admin). Apres avoir cree son compte Supabase Auth (email + mot de passe), ajoutez manuellement sa ligne dans la table `profiles` via Supabase > SQL Editor : `insert into profiles (id, email, name, role) values ('<uuid Supabase>', '<email>', '<nom>', 'admin');`.

## Clientes et rendez-vous (Supabase)

Executez une seule fois `supabase/schema.sql` dans Supabase > SQL Editor : il cree les tables `profiles`/`clients`/`reservations`, les regles de securite (Row Level Security), une vue `reservations_public` qui masque le nom de la cliente et les notes pour tout le monde sauf l'admin et la collaboratrice concernee, et une contrainte qui refuse tout double-reservation d'une salle au niveau de la base de donnees elle-meme (pas seulement en JavaScript).

Comportement :

- a la premiere connexion d'un collaborateur, sa ligne `profiles` Supabase est creee/mise a jour automatiquement (nom, role, email) a partir de sa fiche locale.
- lors de la prise d'un rendez-vous, si la cliente n'est pas dans la liste, sa fiche est recherchee par telephone puis email puis nom, et reutilisee si trouvee ; sinon elle est creee automatiquement.
- la fiche cliente affiche l'historique des rendez-vous, le dernier rendez-vous termine, les allergies/precautions.
- un collaborateur ne voit que les clientes liees a ses propres rendez-vous ; l'admin voit tout. C'est applique par la base de donnees, pas par une simple verification JavaScript.

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

Depuis l'espace admin (page Comptes), un administrateur peut creer, modifier ou supprimer un collaborateur : nom, identifiant, email, telephone, role (admin ou collaborateur), couleur d'affichage dans le planning, salles autorisees et prestations autorisees. Le mot de passe n'est plus defini ici : voir la section "Authentification (Supabase)".

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

- utilisateurs (roles, couleurs, salles/prestations autorisees, photo de profil)
- prestations
- absences, conges

Les clientes et les rendez-vous ne sont plus ici : voir "Clientes et rendez-vous (Supabase)".

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

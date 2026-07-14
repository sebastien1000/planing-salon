-- ============================================================
-- Planning Salon - schema Supabase (profiles, clients, reservations)
--
-- A executer dans Supabase > SQL Editor (project > SQL Editor > New query).
-- Script idempotent : peut etre relance plusieurs fois sans erreur, meme
-- si une execution precedente a deja cree une partie des tables/policies.
-- Ne contient aucun secret : ce script cree seulement la structure et les
-- regles de securite, il ne remplace pas la cle anon/service_role.
--
-- Ordre du fichier (important : les policies de "clients" referencent la
-- table "reservations", qui doit donc deja exister au moment ou elles sont
-- creees) :
--   1. extensions
--   2. table profiles
--   3. table clients
--   4. table reservations
--   5. activation RLS
--   6. fonctions SQL (is_admin)
--   7. policies
--   8. vue reservations_public
--   9. grants / revoke
-- ============================================================

-- 1. Extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- 2. Table profiles : miroir minimal de auth.users, necessaire pour que les
--    regles de securite ci-dessous sachent qui est admin ou non.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'collab')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Table clients
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  notes text,
  allergies text,
  collab_id uuid references profiles(id),
  prestation text,
  duration integer,
  frequency integer,
  next_date date,
  created_at timestamptz not null default now()
);

-- Defense en profondeur contre une double-creation en cas de deux
-- reservations quasi simultanees pour la meme nouvelle cliente.
create unique index if not exists clients_phone_unique
  on clients (phone) where phone is not null and phone <> '';

-- Plusieurs collaboratrices "principales" par fiche cliente (ex. Julie ET
-- Marion) : collab_id (un seul id) reste conserve tel quel (aucune donnee
-- supprimee), mais collab_ids (plusieurs id) est desormais la valeur de
-- reference utilisee par l'application.
alter table clients add column if not exists collab_ids uuid[] not null default '{}';

update clients
set collab_ids = array[collab_id]
where collab_id is not null and collab_ids = '{}';

-- 4. Table reservations (creee apres profiles et clients : cle etrangere sur les deux)
create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  client_name text,
  collab_id uuid references profiles(id) not null,
  room text not null,
  prestation text not null,
  date date not null,
  time time not null,
  duration integer not null,
  status text not null default 'pre'
    check (status in ('pre', 'run', 'done', 'cancel', 'absent', 'move')),
  notes text,
  supplement numeric,
  created_at timestamptz not null default now(),
  -- Protection anti-double-reservation appliquee par PostgreSQL lui-meme :
  -- impossible a contourner meme en appelant l'API directement.
  -- (duration * interval '1 minute') plutot que (duration || ' minutes')::interval :
  -- le cast d'un texte vers interval depend du parsing/locale (STABLE), refuse
  -- dans une expression d'index/exclusion qui exige IMMUTABLE ; la multiplication
  -- entier x interval est une operation immutable.
  exclude using gist (
    room with =,
    date with =,
    tsrange(
      (date + time)::timestamp,
      (date + time)::timestamp + (duration * interval '1 minute')
    ) with &&
  ) where (status <> 'cancel')
);

-- Si la table "reservations" existe deja (script relance apres une premiere
-- execution sans ces contraintes), "create table if not exists" ne les
-- ajoute pas retroactivement : on les ajoute donc explicitement ici, sans
-- erreur si elles existent deja. Actuellement la duree/le supplement ne sont
-- verifies que cote JavaScript (formulaire) ; un appel direct a l'API
-- Supabase avec un compte valide pourrait donc contourner ce controle sans
-- ces contraintes cote base.
-- "not valid" : ne verifie que les nouvelles lignes, pas l'historique
-- existant (evite un blocage si d'anciennes donnees ne respectent pas la
-- regle). Une fois verifie que l'historique est propre, on peut lancer
-- "alter table reservations validate constraint reservations_duration_check;"
-- (et l'equivalent pour le supplement) pour la valider aussi retroactivement.
do $$
begin
  alter table reservations
    add constraint reservations_status_check
    check (status in ('pre', 'run', 'done', 'cancel', 'absent', 'move'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table reservations
    add constraint reservations_duration_check
    check (duration > 0) not valid;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table reservations
    add constraint reservations_supplement_check
    check (supplement is null or supplement >= 0) not valid;
exception
  when duplicate_object then null;
end $$;

-- 5. Activation Row Level Security
alter table profiles enable row level security;
alter table clients enable row level security;
alter table reservations enable row level security;

-- 6. Fonctions SQL
--
-- set search_path = public : sans ca (audit securite), une reference non
-- qualifiee a "profiles"/"reservations" a l'interieur d'une fonction
-- SECURITY DEFINER pourrait en theorie etre detournee si un schema
-- malveillant se glissait plus tot dans le search_path de la session.
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and active);
$$;

-- Jamais appelable par un visiteur non connecte (anon) : Supabase accorde
-- EXECUTE a anon/authenticated par defaut sur toute nouvelle fonction, ce
-- qui exposerait sinon ce SECURITY DEFINER sans authentification via
-- /rest/v1/rpc/is_admin.
revoke execute on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

-- 7. Policies (drop puis create, pour pouvoir relancer le script sans erreur)

-- profiles
drop policy if exists "profiles_select_authenticated" on profiles;
create policy "profiles_select_authenticated"
  on profiles for select
  using (auth.uid() is not null);

-- Un utilisateur peut creer sa PROPRE ligne (auto-enregistrement a la
-- premiere connexion) mais uniquement avec le role 'collab' - impossible
-- de s'auto-declarer admin. Un admin peut creer n'importe quelle ligne
-- avec n'importe quel role. Le tout premier profil (table vide, bootstrap
-- du tout premier admin) est libre.
drop policy if exists "profiles_insert_self_collab_or_admin" on profiles;
create policy "profiles_insert_self_collab_or_admin"
  on profiles for insert
  with check (
    (auth.uid() = id and role = 'collab')
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or not exists (select 1 from profiles)
  );

-- Un utilisateur peut mettre a jour sa propre ligne mais sans changer son
-- propre role (empeche l'auto-promotion admin) ; un admin peut tout
-- modifier, y compris le role des autres.
drop policy if exists "profiles_update_self_or_admin" on profiles;
create policy "profiles_update_self_or_admin"
  on profiles for update
  using (
    auth.uid() = id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    (auth.uid() = id and role = (select p.role from profiles p where p.id = auth.uid()))
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Fonction SECURITY DEFINER (meme principe que is_admin()) : necessaire
-- car la policy SELECT sur "reservations" (section reservations plus bas)
-- ne laisse une collaboratrice voir que SES PROPRES rendez-vous - or ici
-- on doit savoir si N'IMPORTE QUELLE collaboratrice a deja un rendez-vous
-- avec cette cliente, y compris celles des autres. Sans cette fonction,
-- la policy clients ci-dessous ne verrait jamais les rendez-vous des
-- autres collaboratrices et bloquerait a tort l'acces a la fiche cliente.
create or replace function collab_has_reservation_for_client(client_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from reservations r
    where r.client_id = client_uuid and r.collab_id = auth.uid()
  );
$$;

-- Meme raison que is_admin() ci-dessus : ne doit jamais etre appelable
-- par anon (elle renverrait sinon une vraie info - une cliente a-t-elle
-- un rendez-vous ? - sans aucune authentification).
revoke execute on function collab_has_reservation_for_client(uuid) from public, anon;
grant execute on function collab_has_reservation_for_client(uuid) to authenticated;

-- clients : fiche "commune" a toute l'equipe - n'importe quelle
-- collaboratrice connectee peut voir, creer et modifier n'importe quelle
-- fiche cliente (plus seulement les siennes ou celles liees a un de ses
-- rendez-vous). collab_has_reservation_for_client() n'est donc plus
-- utilisee ici, mais reste definie (utilisee ailleurs si besoin).
drop policy if exists "clients_select_admin_or_linked" on clients;
create policy "clients_select_authenticated"
  on clients for select
  using (auth.uid() is not null);

drop policy if exists "clients_insert_authenticated" on clients;
create policy "clients_insert_authenticated"
  on clients for insert
  with check (auth.uid() is not null);

drop policy if exists "clients_update_admin_or_linked" on clients;
create policy "clients_update_authenticated"
  on clients for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- La contrainte de cle etrangere reservations.client_id -> clients.id
-- (sans "on delete cascade") bloque deja la suppression cote base si des
-- rendez-vous y font encore reference : l'application le verifie d'abord
-- pour afficher un message clair (voir js/core/form-clients.js).
drop policy if exists "clients_delete_authenticated" on clients;
create policy "clients_delete_authenticated"
  on clients for delete
  using (auth.uid() is not null);

-- reservations
--
-- Un UPDATE avec clause WHERE (et l'evaluation de la policy RLS USING)
-- exige un droit SELECT sur les colonnes lues, meme sans RETURNING :
-- cette policy doit donc rester au moins aussi restrictive que la policy
-- UPDATE ci-dessous, sinon toute modification de rendez-vous echoue avec
-- une erreur 403 (deja arrive : voir historique). Elle ne donne pas acces
-- aux vrais noms clients des autres collaboratrices pour autant : la
-- lecture "grand public" (planning partage) passe par la vue
-- reservations_public, qui masque ces donnees et s'execute avec les
-- privileges de son proprietaire (elle voit donc toutes les lignes,
-- meme si cette policy-ci ne les donne pas en direct).
drop policy if exists "reservations_select_authenticated" on reservations;
create policy "reservations_select_authenticated"
  on reservations for select
  using (is_admin() or collab_id = auth.uid());

-- N'importe quelle collaboratrice connectee peut prendre un rendez-vous
-- pour N'IMPORTE QUELLE collaboratrice (pas seulement l'admin, pas
-- seulement elle-meme) : demande explicitement pour la prise de RDV. La
-- modification/l'annulation d'un rendez-vous deja cree reste, elle,
-- reservee a l'admin ou a la collaboratrice concernee (policy juste en
-- dessous, inchangee).
drop policy if exists "reservations_insert_admin_or_own" on reservations;
create policy "reservations_insert_authenticated"
  on reservations for insert
  with check (auth.uid() is not null);

drop policy if exists "reservations_update_admin_or_own" on reservations;
create policy "reservations_update_admin_or_own"
  on reservations for update
  using (is_admin() or collab_id = auth.uid());

-- 7bis. Prestations par collaboratrice (tarif/duree propres a chacune)
--
-- Avant : "prestations" etait une liste globale partagee (localStorage),
-- meme prix/duree pour tout le monde. Desormais :
--   - service_categories : les grandes familles (Ongles, Cils, ...)
--   - services            : le catalogue general des prestations possibles
--                            (pas de prix ici : juste le nom/la categorie)
--   - collaborator_services : le lien entre une collaboratrice et un
--                            service, avec SON tarif et SA duree a elle
--
-- Fonction reutilisable pour tenir updated_at a jour automatiquement.
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on service_categories;
create trigger set_updated_at
  before update on service_categories
  for each row execute function set_updated_at();

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references service_categories(id) on delete set null,
  name text not null,
  description text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create index if not exists services_category_id_idx on services (category_id);

drop trigger if exists set_updated_at on services;
create trigger set_updated_at
  before update on services
  for each row execute function set_updated_at();

create table if not exists collaborator_services (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references profiles(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  price numeric not null,
  duration_minutes integer not null,
  active boolean not null default true,
  custom_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collaborator_id, service_id),
  constraint collaborator_services_price_check check (price >= 0),
  constraint collaborator_services_duration_check check (duration_minutes > 0)
);

create index if not exists collaborator_services_collaborator_id_idx on collaborator_services (collaborator_id);
create index if not exists collaborator_services_service_id_idx on collaborator_services (service_id);

drop trigger if exists set_updated_at on collaborator_services;
create trigger set_updated_at
  before update on collaborator_services
  for each row execute function set_updated_at();

-- Photo figee du service/tarif au moment du rendez-vous : si le tarif
-- change plus tard, les rendez-vous deja enregistres doivent garder
-- l'ancien prix. La colonne "prestation" (texte) existante joue deja ce
-- role pour le nom ; il manquait l'equivalent pour le prix et un lien
-- structure vers le service.
alter table reservations add column if not exists service_id uuid references services(id) on delete set null;
alter table reservations add column if not exists price numeric;

do $$
begin
  alter table reservations
    add constraint reservations_price_check
    check (price is null or price >= 0) not valid;
exception
  when duplicate_object then null;
end $$;

alter table service_categories enable row level security;
alter table services enable row level security;
alter table collaborator_services enable row level security;

-- Categories/services : lecture pour tout utilisateur connecte (necessaire
-- pour construire le menu de prestations), ecriture reservee a l'admin.
drop policy if exists "service_categories_select_authenticated" on service_categories;
create policy "service_categories_select_authenticated"
  on service_categories for select
  using (auth.uid() is not null);

drop policy if exists "service_categories_write_admin" on service_categories;
create policy "service_categories_write_admin"
  on service_categories for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "services_select_authenticated" on services;
create policy "services_select_authenticated"
  on services for select
  using (auth.uid() is not null);

drop policy if exists "services_write_admin" on services;
create policy "services_write_admin"
  on services for all
  using (is_admin())
  with check (is_admin());

-- collaborator_services : l'admin voit/gere tout ; chaque collaboratrice ne
-- voit et ne modifie QUE ses propres tarifs/durees, jamais ceux d'une autre.
drop policy if exists "collaborator_services_select_admin_or_own" on collaborator_services;
create policy "collaborator_services_select_admin_or_own"
  on collaborator_services for select
  using (is_admin() or collaborator_id = auth.uid());

drop policy if exists "collaborator_services_insert_admin_or_own" on collaborator_services;
create policy "collaborator_services_insert_admin_or_own"
  on collaborator_services for insert
  with check (is_admin() or collaborator_id = auth.uid());

drop policy if exists "collaborator_services_update_admin_or_own" on collaborator_services;
create policy "collaborator_services_update_admin_or_own"
  on collaborator_services for update
  using (is_admin() or collaborator_id = auth.uid())
  with check (is_admin() or collaborator_id = auth.uid());

drop policy if exists "collaborator_services_delete_admin_or_own" on collaborator_services;
create policy "collaborator_services_delete_admin_or_own"
  on collaborator_services for delete
  using (is_admin() or collaborator_id = auth.uid());

-- Catalogue de depart (categories + prestations), pour ne pas repartir
-- d'une page blanche. Aucun tarif ici : chaque collaboratrice (ou l'admin
-- pour elle) doit definir son propre prix/sa propre duree ensuite via
-- l'interface "Prestations". Idempotent grace a "on conflict do nothing"
-- (slug unique pour les categories, (category_id, name) unique pour les
-- services).
insert into service_categories (name, slug, display_order) values
  ('Ongles', 'ongles', 1),
  ('Cils', 'cils', 2),
  ('Sourcils', 'sourcils', 3),
  ('Épilation', 'epilation', 4),
  ('Tatouage', 'tatouage', 5),
  ('Baby Spa', 'baby-spa', 6),
  ('Autres', 'autres', 7)
on conflict (slug) do nothing;

insert into services (category_id, name, display_order)
select c.id, s.name, s.display_order
from service_categories c
join (values
  ('ongles', 'Pose ongles naturels', 1),
  ('ongles', 'Pose gel', 2),
  ('ongles', 'Pose complète chablon', 3),
  ('ongles', 'Remplissage', 4),
  ('ongles', 'Dépose', 5),
  ('ongles', 'Dépose avec nouvelle pose', 6),
  ('ongles', 'Semi-permanent mains', 7),
  ('ongles', 'Semi-permanent pieds', 8),
  ('ongles', 'Renfort', 9),
  ('ongles', 'Reconstruction pieds', 14),
  ('cils', 'Cils à cils', 1),
  ('cils', 'Volume russe', 2),
  ('cils', 'Remplissage cils à cils', 3),
  ('cils', 'Dépose cils', 4),
  ('sourcils', 'Restructuration', 1),
  ('sourcils', 'Teinture', 2),
  ('sourcils', 'Brow lift', 3),
  ('epilation', 'Sourcils', 1),
  ('epilation', 'Lèvre', 2),
  ('epilation', 'Visage', 3),
  ('epilation', 'Jambes', 4),
  ('tatouage', 'Tatouage', 1),
  ('baby-spa', 'Baby Spa', 1),
  ('autres', 'Prestation personnalisée', 1),
  ('autres', 'Prestation extérieure', 2)
) as s(category_slug, name, display_order) on s.category_slug = c.slug
on conflict (category_id, name) do nothing;

-- 8. Vue reservations_public
-- L'app ne doit jamais lire la table brute (elle contient le vrai nom de
-- cliente et les notes privees) : seule cette vue, qui masque ces colonnes
-- pour les autres collaborateurs, doit etre interrogee cote client.
drop view if exists reservations_public;
create or replace view reservations_public as
select
  r.id,
  r.client_id,
  case when is_admin() or r.collab_id = auth.uid()
    then r.client_name
    else 'Reserve'
  end as client_name,
  r.collab_id,
  p.name as collab_name,
  r.room,
  r.prestation,
  r.service_id,
  r.price,
  r.date,
  r.time,
  r.duration,
  r.status,
  case when is_admin() or r.collab_id = auth.uid()
    then r.notes
    else null
  end as notes,
  r.supplement
from reservations r
join profiles p on p.id = r.collab_id;

-- 9. Grants / revoke
--
-- Le SELECT direct sur reservations reste indispensable (Postgres l'exige
-- pour evaluer la clause WHERE et la policy RLS USING de tout UPDATE,
-- meme sans RETURNING) : on ne peut pas le revoquer entierement sans
-- casser toute modification de rendez-vous. La confidentialite (masquer
-- le vrai nom client/notes des autres collaboratrices) est assuree par la
-- policy "reservations_select_authenticated" ci-dessus (restreinte a
-- l'admin ou sa propre collaboratrice), pas par ce grant.
grant select on reservations to authenticated;
grant select on reservations_public to authenticated;
-- Les insertions/modifications passent par la table reservations elle-meme
-- (RLS ci-dessus), la vue sert uniquement a la lecture masquee.
grant insert, update on reservations to authenticated;

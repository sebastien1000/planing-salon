-- ============================================================
-- Planning Salon - schema Supabase (profiles, clients, reservations)
--
-- A executer UNE SEULE FOIS dans Supabase > SQL Editor (project > SQL Editor > New query).
-- Ne contient aucun secret : ce script cree seulement la structure et les
-- regles de securite, il ne remplace pas la cle anon/service_role.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists btree_gist;

-- 1. Profils : miroir minimal de auth.users, necessaire pour que les
--    regles de securite ci-dessous sachent qui est admin ou non.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'collab')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_authenticated"
  on profiles for select
  using (auth.uid() is not null);

-- Un utilisateur peut creer sa PROPRE ligne (auto-enregistrement a la
-- premiere connexion) mais uniquement avec le role 'collab' - impossible
-- de s'auto-declarer admin. Un admin peut creer n'importe quelle ligne
-- avec n'importe quel role. Le tout premier profil (table vide, bootstrap
-- du tout premier admin) est libre.
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

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and active);
$$;

-- 2. Clientes
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

alter table clients enable row level security;

create policy "clients_select_admin_or_linked"
  on clients for select
  using (
    is_admin()
    or collab_id = auth.uid()
    or exists (
      select 1 from reservations r
      where r.client_id = clients.id and r.collab_id = auth.uid()
    )
  );

create policy "clients_insert_authenticated"
  on clients for insert
  with check (auth.uid() is not null);

create policy "clients_update_admin_or_linked"
  on clients for update
  using (is_admin() or collab_id = auth.uid());

-- 3. Rendez-vous
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
  status text not null default 'pre',
  notes text,
  supplement numeric,
  created_at timestamptz not null default now(),
  -- Protection anti-double-reservation appliquee par PostgreSQL lui-meme :
  -- impossible a contourner meme en appelant l'API directement.
  exclude using gist (
    room with =,
    date with =,
    tsrange(
      (date + time)::timestamp,
      (date + time)::timestamp + (duration || ' minutes')::interval
    ) with &&
  ) where (status <> 'cancel')
);

alter table reservations enable row level security;

create policy "reservations_select_authenticated"
  on reservations for select
  using (auth.uid() is not null);

create policy "reservations_insert_admin_or_own"
  on reservations for insert
  with check (is_admin() or collab_id = auth.uid());

create policy "reservations_update_admin_or_own"
  on reservations for update
  using (is_admin() or collab_id = auth.uid());

-- L'app ne doit jamais lire la table brute (elle contient le vrai nom de
-- cliente et les notes privees) : seule la vue ci-dessous, qui masque ces
-- colonnes pour les autres collaborateurs, doit etre interrogee cote client.
revoke select on reservations from authenticated;

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

grant select on reservations_public to authenticated;

-- Les insertions/modifications passent par la table reservations elle-meme
-- (RLS ci-dessus), la vue sert uniquement a la lecture masquee.
grant insert, update on reservations to authenticated;

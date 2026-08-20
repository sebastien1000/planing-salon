-- ============================================================
-- Planning Salon - reglage d'apparence partage (theme saisonnier anime)
--
-- A executer a la main dans Supabase > SQL Editor, comme supabase/schema.sql
-- (ce projet n'utilise pas le workflow "supabase db push"). Script
-- idempotent : peut etre relance plusieurs fois sans erreur.
--
-- Portee : UNE seule table, "app_settings", UNE seule ligne (id = 1),
-- utilisee exclusivement par js/themes/theme-manager.js pour que le choix
-- de theme fait par l'admin (Admin > Apparence) s'applique a tout le salon.
-- Aucune donnee metier (rendez-vous/clients/profils/etc) n'est touchee par
-- ce script. Reutilise la fonction is_admin() deja creee par schema.sql.
-- ============================================================

create table if not exists app_settings (
  id smallint primary key default 1,
  theme_mode text not null default 'automatic' check (theme_mode in ('automatic', 'manual')),
  active_theme text not null default 'default' check (active_theme in (
    'default', 'halloween', 'christmas', 'valentine', 'easter',
    'spring', 'summer', 'autumn', 'new-year'
  )),
  animations_enabled boolean not null default true,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id = 1)
);

insert into app_settings (id)
values (1)
on conflict (id) do nothing;

alter table app_settings enable row level security;

-- Lecture : tout compte connecte (chaque collaboratrice doit voir le theme
-- choisi par l'admin des l'ouverture de l'app).
drop policy if exists "app_settings_select_authenticated" on app_settings;
create policy "app_settings_select_authenticated"
  on app_settings for select
  to authenticated
  using (true);

-- Ecriture : reservee a l'admin (meme regle que le reste de l'espace
-- Admin), une seule ligne (id = 1) ne peut de toute facon jamais etre
-- inseree une seconde fois grace a la contrainte ci-dessus.
drop policy if exists "app_settings_update_admin" on app_settings;
create policy "app_settings_update_admin"
  on app_settings for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "app_settings_insert_admin" on app_settings;
create policy "app_settings_insert_admin"
  on app_settings for insert
  to authenticated
  with check (is_admin());

grant select, insert, update on app_settings to authenticated;
revoke all on app_settings from anon;

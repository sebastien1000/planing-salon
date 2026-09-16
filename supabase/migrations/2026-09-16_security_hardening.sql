-- =====================================================================
-- Sécurité planning-salon : correctifs appliqués le 16/09/2026
-- Déjà appliqué sur Supabase. Ce fichier sert à garder ton projet à jour
-- (à placer dans supabase/migrations/). Ne pas le rejouer à la main.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. Fuite critique : plus d'accès anonyme aux vues
-- ---------------------------------------------------------------------
revoke all on public.reservations_public, public.blocked_periods_public from anon;
revoke insert, update, delete, truncate, references, trigger on public.reservations_public, public.blocked_periods_public from authenticated;
grant select on public.reservations_public, public.blocked_periods_public to authenticated;

-- ---------------------------------------------------------------------
-- B. Accès réservé aux membres ACTIFS
-- ---------------------------------------------------------------------
create or replace function public.is_active_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and active);
$$;
revoke execute on function public.is_active_staff() from public, anon;
grant execute on function public.is_active_staff() to authenticated;

-- Vues : membres actifs uniquement.
-- ⚠️ Si tu recrées une vue (drop + create), remets TOUJOURS les revoke/grant juste après.
create or replace view public.reservations_public as
 SELECT r.id, r.client_id, r.client_name, r.collab_id, p.name AS collab_name,
    r.room, r.prestation, r.service_id, r.price, r.payment_method, r.list_price,
    r.date, r."time", r.duration, r.status,
    CASE WHEN is_admin() OR r.collab_id = auth.uid() THEN r.notes ELSE NULL::text END AS notes,
    r.supplement
   FROM reservations r
     JOIN profiles p ON p.id = r.collab_id
  WHERE is_active_staff();

create or replace view public.blocked_periods_public as
 SELECT bp.id, bp.kind, bp.collab_id, p.name AS collab_name,
    CASE WHEN bp.kind = 'holiday'::text OR is_admin() OR bp.collab_id = auth.uid() THEN bp.category ELSE NULL::text END AS category,
    bp.start_date, bp.start_time, bp.end_date, bp.end_time,
    CASE WHEN bp.kind = 'holiday'::text OR is_admin() OR bp.collab_id = auth.uid() THEN bp.notes ELSE NULL::text END AS notes
   FROM blocked_periods bp
     JOIN profiles p ON p.id = bp.collab_id
  WHERE is_active_staff();

revoke all on public.reservations_public, public.blocked_periods_public from anon, authenticated;
grant select on public.reservations_public, public.blocked_periods_public to authenticated;

-- Profiles
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_staff_or_self on public.profiles
  for select to authenticated
  using (is_active_staff() or id = auth.uid());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (is_admin() or (id = auth.uid() and is_active_staff()))
  with check (
    is_admin()
    or (
      id = auth.uid()
      and role   = (select p.role   from profiles p where p.id = auth.uid())
      and active = (select p.active from profiles p where p.id = auth.uid())
    )
  );

-- Clients (partagés entre membres actifs)
drop policy if exists clients_select_authenticated on public.clients;
drop policy if exists clients_insert_authenticated on public.clients;
drop policy if exists clients_update_authenticated on public.clients;
create policy clients_select_staff on public.clients
  for select to authenticated using (is_active_staff());
create policy clients_insert_staff on public.clients
  for insert to authenticated with check (is_active_staff());
create policy clients_update_staff on public.clients
  for update to authenticated using (is_active_staff()) with check (is_active_staff());

-- Réservations (réserver pour une collègue reste autorisé)
drop policy if exists reservations_select_authenticated on public.reservations;
create policy reservations_select_admin_or_own on public.reservations
  for select to authenticated
  using (is_admin() or (collab_id = auth.uid() and is_active_staff()));

drop policy if exists reservations_insert_authenticated on public.reservations;
create policy reservations_insert_staff on public.reservations
  for insert to authenticated with check (is_active_staff());

drop policy if exists reservations_update_admin_or_own on public.reservations;
create policy reservations_update_admin_or_own on public.reservations
  for update to authenticated
  using (is_admin() or (collab_id = auth.uid() and is_active_staff()))
  with check (is_active_staff());

-- Services et catégories
drop policy if exists services_select_authenticated on public.services;
drop policy if exists services_insert_authenticated on public.services;
create policy services_select_staff on public.services
  for select to authenticated using (is_active_staff());
create policy services_insert_staff on public.services
  for insert to authenticated with check (is_active_staff());

drop policy if exists service_categories_select_authenticated on public.service_categories;
create policy service_categories_select_staff on public.service_categories
  for select to authenticated using (is_active_staff());

-- Périodes bloquées
drop policy if exists blocked_periods_select_admin_or_own on public.blocked_periods;
drop policy if exists blocked_periods_insert_authorized on public.blocked_periods;
drop policy if exists blocked_periods_update_authorized on public.blocked_periods;
drop policy if exists blocked_periods_delete_authorized on public.blocked_periods;
create policy blocked_periods_select_admin_or_own on public.blocked_periods
  for select to authenticated using (is_admin() or (collab_id = auth.uid() and is_active_staff()));
create policy blocked_periods_insert_admin_or_own on public.blocked_periods
  for insert to authenticated with check (is_admin() or (collab_id = auth.uid() and is_active_staff()));
create policy blocked_periods_update_admin_or_own on public.blocked_periods
  for update to authenticated
  using (is_admin() or (collab_id = auth.uid() and is_active_staff()))
  with check (is_admin() or (collab_id = auth.uid() and is_active_staff()));
create policy blocked_periods_delete_admin_or_own on public.blocked_periods
  for delete to authenticated using (is_admin() or (collab_id = auth.uid() and is_active_staff()));

-- Services des collaboratrices
drop policy if exists collaborator_services_select_admin_or_own on public.collaborator_services;
drop policy if exists collaborator_services_insert_admin_or_own on public.collaborator_services;
drop policy if exists collaborator_services_update_admin_or_own on public.collaborator_services;
drop policy if exists collaborator_services_delete_admin_or_own on public.collaborator_services;
create policy collaborator_services_select_admin_or_own on public.collaborator_services
  for select to authenticated using (is_admin() or (collaborator_id = auth.uid() and is_active_staff()));
create policy collaborator_services_insert_admin_or_own on public.collaborator_services
  for insert to authenticated with check (is_admin() or (collaborator_id = auth.uid() and is_active_staff()));
create policy collaborator_services_update_admin_or_own on public.collaborator_services
  for update to authenticated
  using (is_admin() or (collaborator_id = auth.uid() and is_active_staff()))
  with check (is_admin() or (collaborator_id = auth.uid() and is_active_staff()));
create policy collaborator_services_delete_admin_or_own on public.collaborator_services
  for delete to authenticated using (is_admin() or (collaborator_id = auth.uid() and is_active_staff()));

-- Aucun droit anonyme, y compris sur les futurs objets
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------
-- C. Nouvelle collaboratrice : inactive jusqu'à validation
-- ---------------------------------------------------------------------
create or replace function public.profiles_force_pending()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_active_staff() then
    new.active := false;
    new.role := 'collab';
  end if;
  return new;
end;
$$;
revoke execute on function public.profiles_force_pending() from public, anon, authenticated;

drop trigger if exists profiles_force_pending on public.profiles;
create trigger profiles_force_pending
  before insert on public.profiles
  for each row execute function public.profiles_force_pending();

drop policy if exists profiles_insert_self_collab_or_admin on public.profiles;
create policy profiles_insert_self_collab_or_staff on public.profiles
  for insert to authenticated
  with check (
    is_admin()
    or (id = auth.uid() and role = 'collab')
    or (is_active_staff() and role = 'collab')
  );

-- Appel depuis l'appli : supabase.rpc('validate_collaborator', { target: '<id du profil>' })
create or replace function public.validate_collaborator(target uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_staff() then
    raise exception 'Accès refusé';
  end if;
  update profiles set active = true where id = target and role = 'collab';
  return found;
end;
$$;
revoke execute on function public.validate_collaborator(uuid) from public, anon;
grant execute on function public.validate_collaborator(uuid) to authenticated;

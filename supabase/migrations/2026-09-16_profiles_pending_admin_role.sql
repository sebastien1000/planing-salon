-- Suite de 2026-09-16_security_hardening.sql : corrige le cas d'un nouvel
-- admin ajoute via "Ajouter un collaborateur" (page Comptes), qui n'est
-- pas cree directement dans Supabase.
--
-- Probleme : le trigger profiles_force_pending forcait *aussi*
-- role = 'collab' a la premiere connexion de quiconque n'est pas deja
-- membre actif. Comme les triggers BEFORE INSERT s'executent avant que
-- la policy RLS (WITH CHECK) soit evaluee, l'insertion reussissait quand
-- meme, mais silencieusement degradee : un nouvel admin atterrissait
-- comme simple collaboratrice en attente, sans que l'app ni l'admin ne
-- le sache (rien n'echouait, donc rien n'alertait personne).
--
-- Correctif : le trigger ne force plus que active = false (personne ne
-- peut jamais s'auto-activer, quel que soit le role demande) ; le role
-- demande (collab ou admin) est conserve tel quel, pour que la fiche
-- "en attente" affichee a l'admin soit honnete sur ce qu'il doit valider.
-- Cote securite, aucun changement : is_admin() et is_active_staff()
-- exigent tous les deux active = true, donc un profil "role = admin,
-- active = false" n'a strictement aucun droit tant qu'un admin existant
-- ne l'a pas active a la main (page Comptes). validate_collaborator()
-- reste volontairement limitee a role = 'collab' : seul un admin peut
-- activer un profil role = 'admin'.
create or replace function public.profiles_force_pending()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_active_staff() then
    new.active := false;
  end if;
  return new;
end;
$$;

drop policy if exists profiles_insert_self_collab_or_staff on public.profiles;
create policy profiles_insert_self_or_staff on public.profiles
  for insert to authenticated
  with check (
    is_admin()
    or (id = auth.uid() and role in ('collab', 'admin'))
    or (is_active_staff() and role = 'collab')
  );

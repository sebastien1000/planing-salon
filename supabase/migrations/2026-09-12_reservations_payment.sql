-- Fiche de caisse par collaboratrice : moyen de paiement + prix catalogue
-- avant remise, pour pouvoir calculer les totaux par moyen de paiement et
-- les remises/prestations offertes sans perdre l'info une fois le RDV
-- termine (reservations.price est deja ecrase par le prix final au moment
-- ou le RDV passe a "done", voir js/core/form-reservations.js).
--
-- Pas de colonne "is_free" separee : une prestation offerte se deduit de
-- price = 0 et list_price > 0 (sinon c'est juste une prestation dont le
-- tarif catalogue est deja 0, pas un cadeau).
alter table reservations add column if not exists payment_method text;
alter table reservations add column if not exists list_price numeric;

do $$
begin
  alter table reservations
    add constraint reservations_payment_method_check
    check (payment_method is null or payment_method in ('cash', 'card', 'transfer', 'check'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table reservations
    add constraint reservations_list_price_check
    check (list_price is null or list_price >= 0) not valid;
exception
  when duplicate_object then null;
end $$;

-- La vue publique doit exposer les deux nouvelles colonnes, sinon
-- reservations_public.select("*") ne les renverrait jamais a l'app.
drop view if exists reservations_public;
create or replace view reservations_public as
select
  r.id,
  r.client_id,
  r.client_name,
  r.collab_id,
  p.name as collab_name,
  r.room,
  r.prestation,
  r.service_id,
  r.price,
  r.payment_method,
  r.list_price,
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

-- Un RDV "Exterieur" (prestation a domicile, evenement...) n'est pas lie a
-- une salle physique du salon : plusieurs collaboratrices doivent pouvoir y
-- etre en meme temps. Le JavaScript (js/core/domain.js, conflictDetails)
-- ignore deja ce conflit de salle pour "Exterieur", mais la contrainte
-- anti-double-reservation en base (salle+creneau) n'avait, elle, aucune
-- exception : deux RDV "Exterieur" au meme horaire pour deux collaboratrices
-- differentes echouaient donc quand meme cote base de donnees.
--
-- Le nom de la contrainte est auto-genere par Postgres (jamais nomme
-- explicitement dans schema.sql) : on le retrouve dynamiquement via
-- pg_constraint plutot que de le deviner.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'reservations'::regclass and contype = 'x';

  if cname is not null then
    execute format('alter table reservations drop constraint %I', cname);
  end if;
end $$;

alter table reservations
  add constraint reservations_room_time_excl
  exclude using gist (
    room with =,
    date with =,
    tsrange(
      (date + time)::timestamp,
      (date + time)::timestamp + (duration * interval '1 minute')
    ) with &&
  ) where (status <> 'cancel' and room <> 'Exterieur');

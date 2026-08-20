-- Préférences Theme Engine individuelles et synchronisées entre appareils.
-- Idempotent, sans modification des tables métier.
create table if not exists user_theme_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  selected_theme text not null default 'default' check (selected_theme in (
    'default', 'halloween', 'noel', 'nouvel-an', 'hiver', 'printemps',
    'plage', 'automne', 'tropical', 'cocooning', 'disco', 'galaxy',
    'floral', 'chic-noir', 'rose-gold'
  )),
  animations_enabled boolean not null default true,
  last_seasonal_activation_id text,
  updated_at timestamptz not null default now()
);

alter table user_theme_preferences enable row level security;

drop policy if exists "theme_preferences_select_self" on user_theme_preferences;
create policy "theme_preferences_select_self"
  on user_theme_preferences for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "theme_preferences_insert_self" on user_theme_preferences;
create policy "theme_preferences_insert_self"
  on user_theme_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "theme_preferences_update_self" on user_theme_preferences;
create policy "theme_preferences_update_self"
  on user_theme_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on user_theme_preferences to authenticated;
revoke all on user_theme_preferences from anon;

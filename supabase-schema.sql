-- Ejecuta este script completo en Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.family_members (
  family_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists public.family_config (
  family_id uuid primary key,
  config jsonb not null default '{"schedule":{},"events":[]}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.family_members enable row level security;
alter table public.family_config enable row level security;

drop policy if exists "Members can read their own membership" on public.family_members;
create policy "Members can read their own membership"
on public.family_members for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Family members can read family config" on public.family_config;
create policy "Family members can read family config"
on public.family_config for select to authenticated
using (exists (
  select 1 from public.family_members m
  where m.family_id = family_config.family_id and m.user_id = auth.uid()
));

drop policy if exists "Family members can insert family config" on public.family_config;
create policy "Family members can insert family config"
on public.family_config for insert to authenticated
with check (exists (
  select 1 from public.family_members m
  where m.family_id = family_config.family_id and m.user_id = auth.uid()
));

drop policy if exists "Family members can update family config" on public.family_config;
create policy "Family members can update family config"
on public.family_config for update to authenticated
using (exists (
  select 1 from public.family_members m
  where m.family_id = family_config.family_id and m.user_id = auth.uid()
))
with check (exists (
  select 1 from public.family_members m
  where m.family_id = family_config.family_id and m.user_id = auth.uid()
));

-- Habilita cambios en tiempo real para la tabla compartida.
do $$
begin
  alter publication supabase_realtime add table public.family_config;
exception when duplicate_object then null;
end $$;

-- La pertenencia se añade manualmente desde SQL Editor (pasos en README).
-- No se permite a los usuarios autoañadirse a la familia desde el navegador.

-- Run this in Supabase SQL Editor after creating a project.
create extension if not exists "uuid-ossp";

create table if not exists festivals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  event_date date,
  date_status text default 'confirmed' check (date_status in ('confirmed','estimated','awaiting_announcement')),
  location text default 'Malaysia',
  source_url text,
  ai_discovered boolean default false,
  created_at timestamptz default now()
);

create table if not exists poster_tasks (
  id uuid primary key default uuid_generate_v4(),
  festival_id uuid references festivals(id) on delete cascade not null,
  assigned_to uuid references auth.users(id) on delete set null,
  deadline date,
  status text default 'pending' check (status in ('pending','ongoing','done','overdue')),
  poster_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists team_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text default 'designer' check (role in ('admin','coordinator','designer')),
  email text,
  created_at timestamptz default now()
);

alter table festivals enable row level security;
alter table poster_tasks enable row level security;
alter table team_profiles enable row level security;

drop policy if exists "authenticated users can view festivals" on festivals;
drop policy if exists "authenticated users can manage festivals" on festivals;
drop policy if exists "authenticated users can view tasks" on poster_tasks;
drop policy if exists "authenticated users can manage tasks" on poster_tasks;
drop policy if exists "authenticated users can view profiles" on team_profiles;
drop policy if exists "admins and coordinators manage festivals" on festivals;
drop policy if exists "admins and coordinators create tasks" on poster_tasks;
drop policy if exists "members update assigned tasks" on poster_tasks;

create policy "authenticated users can view festivals" on festivals for select to authenticated using (true);
create policy "authenticated users can manage festivals" on festivals for all to authenticated using (true) with check (true);
create policy "authenticated users can view tasks" on poster_tasks for select to authenticated using (true);
create policy "authenticated users can manage tasks" on poster_tasks for all to authenticated using (true) with check (true);
create policy "authenticated users can view profiles" on team_profiles for select to authenticated using (true);

-- Role-aware access: admins and coordinators manage planning data; designers
-- can view everything and update tasks assigned to themselves.
create or replace function public.can_manage_planning()
returns boolean language sql security definer set search_path = public stable as $$
  select exists(select 1 from public.team_profiles where id = auth.uid() and role in ('admin','coordinator'));
$$;

drop policy if exists "authenticated users can manage festivals" on festivals;
drop policy if exists "authenticated users can manage tasks" on poster_tasks;
create policy "admins and coordinators manage festivals" on festivals for all to authenticated using (public.can_manage_planning()) with check (public.can_manage_planning());
create policy "admins and coordinators create tasks" on poster_tasks for insert to authenticated with check (public.can_manage_planning());
create policy "members update assigned tasks" on poster_tasks for update to authenticated using (public.can_manage_planning() or assigned_to = auth.uid()) with check (public.can_manage_planning() or assigned_to = auth.uid());

-- Create an assignable team profile automatically for every new account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.team_profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for accounts that existed before the trigger was added.
insert into public.team_profiles (id, full_name, email)
select id,
       coalesce(nullif(raw_user_meta_data->>'full_name', ''), split_part(email, '@', 1)),
       email
from auth.users
on conflict (id) do update set email = excluded.email;

-- Storage foundation for uploaded poster assets.
insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do nothing;

drop policy if exists "authenticated users upload posters" on storage.objects;
drop policy if exists "authenticated users update posters" on storage.objects;
drop policy if exists "public can view posters" on storage.objects;
create policy "authenticated users upload posters" on storage.objects for insert to authenticated with check (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "authenticated users update posters" on storage.objects for update to authenticated using (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public can view posters" on storage.objects for select to public using (bucket_id = 'posters');

-- شغّل هذا الملف في Supabase SQL Editor لحل الخطأ وإضافة مقترحات المبادرات

alter table if exists public.student_issues
  add column if not exists phone_number text;

create table if not exists public.student_initiatives (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  details text,
  initiative_date date,
  category text,
  status text default 'مقترحة',
  organizer text,
  target_group text,
  icon text default 'fa-solid fa-hand-holding-heart',
  image_url text,
  gallery_images jsonb default '[]'::jsonb,
  sort_order integer default 1,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  value integer,
  icon text default 'fa-solid fa-trophy',
  sort_order integer default 1,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table if exists public.achievements
  add column if not exists description text,
  add column if not exists details text,
  add column if not exists achievement_date date,
  add column if not exists category text,
  add column if not exists image_url text,
  add column if not exists gallery_images jsonb default '[]'::jsonb,
  add column if not exists updated_at timestamptz;

create table if not exists public.student_initiative_suggestions (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  phone_number text not null,
  initiative_title text not null,
  initiative_category text,
  initiative_goal text,
  initiative_description text not null,
  target_group text,
  expected_needs text,
  suggested_team text,
  status text default 'new',
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

alter table public.student_initiatives enable row level security;
alter table public.achievements enable row level security;
alter table public.student_initiative_suggestions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='student_initiatives' and policyname='Public can read active student initiatives') then
    create policy "Public can read active student initiatives" on public.student_initiatives for select using (is_active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='student_initiatives' and policyname='Authenticated admins can manage student initiatives') then
    create policy "Authenticated admins can manage student initiatives" on public.student_initiatives for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='achievements' and policyname='Public can read active achievements') then
    create policy "Public can read active achievements" on public.achievements for select using (is_active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='achievements' and policyname='Authenticated admins can manage achievements') then
    create policy "Authenticated admins can manage achievements" on public.achievements for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='student_initiative_suggestions' and policyname='Students can submit initiative suggestions') then
    create policy "Students can submit initiative suggestions" on public.student_initiative_suggestions for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='student_initiative_suggestions' and policyname='Authenticated admins can read initiative suggestions') then
    create policy "Authenticated admins can read initiative suggestions" on public.student_initiative_suggestions for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='student_initiative_suggestions' and policyname='Authenticated admins can update initiative suggestions') then
    create policy "Authenticated admins can update initiative suggestions" on public.student_initiative_suggestions for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='student_initiative_suggestions' and policyname='Authenticated admins can delete initiative suggestions') then
    create policy "Authenticated admins can delete initiative suggestions" on public.student_initiative_suggestions for delete to authenticated using (true);
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');

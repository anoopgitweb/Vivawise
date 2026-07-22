create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role public.app_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  description text not null default '',
  difficulty text not null default 'Standard' check (difficulty in ('Foundation','Standard','Challenge')),
  openai_vector_store_id text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.test_documents (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null,
  openai_file_id text,
  status text not null default 'pending' check (status in ('pending','processing','ready','failed')),
  error_message text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.test_assignments (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  unique(test_id, user_id)
);

create table public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id),
  user_id uuid not null references public.profiles(id),
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  score numeric,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question text not null,
  answer text not null,
  score numeric not null,
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,role)
  values(new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'full_name',''),
    case when not exists(select 1 from public.profiles) then 'admin'::public.app_role else 'student'::public.app_role end);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

alter table public.profiles enable row level security;
alter table public.tests enable row level security;
alter table public.test_documents enable row level security;
alter table public.test_assignments enable row level security;
alter table public.test_attempts enable row level security;
alter table public.attempt_answers enable row level security;

create policy "profiles self or admin read" on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy "admin manages profiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "admin manages tests" on public.tests for all using (public.is_admin()) with check (public.is_admin());
create policy "students read assigned tests" on public.tests for select using (exists(select 1 from public.test_assignments a where a.test_id=id and a.user_id=auth.uid()));
create policy "admin manages documents" on public.test_documents for all using (public.is_admin()) with check (public.is_admin());
create policy "students read assigned document metadata" on public.test_documents for select using (exists(select 1 from public.test_assignments a where a.test_id=test_id and a.user_id=auth.uid()));
create policy "admin manages assignments" on public.test_assignments for all using (public.is_admin()) with check (public.is_admin());
create policy "students read own assignments" on public.test_assignments for select using (user_id=auth.uid());
create policy "students manage own attempts" on public.test_attempts for all using (user_id=auth.uid()) with check (user_id=auth.uid() and exists(select 1 from public.test_assignments a where a.test_id=test_id and a.user_id=auth.uid()));
create policy "students manage own answers" on public.attempt_answers for all using (exists(select 1 from public.test_attempts x where x.id=attempt_id and x.user_id=auth.uid())) with check (exists(select 1 from public.test_attempts x where x.id=attempt_id and x.user_id=auth.uid()));

insert into storage.buckets(id,name,public) values('test-documents','test-documents',false) on conflict(id) do nothing;
create policy "admins upload test documents" on storage.objects for insert to authenticated with check (bucket_id='test-documents' and public.is_admin());
create policy "admins manage test documents" on storage.objects for all to authenticated using (bucket_id='test-documents' and public.is_admin());
create policy "assigned users read test documents" on storage.objects for select to authenticated using (bucket_id='test-documents' and exists(select 1 from public.test_assignments a where a.user_id=auth.uid() and (storage.foldername(name))[1]=a.test_id::text));

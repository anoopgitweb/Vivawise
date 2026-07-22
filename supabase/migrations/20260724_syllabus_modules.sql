alter table public.tests
  add column if not exists syllabus_modules jsonb not null default '[]'::jsonb;

alter table public.test_attempts
  add column if not exists selected_module text;

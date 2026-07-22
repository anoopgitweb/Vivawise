alter table public.tests
  add column if not exists question_count integer not null default 10 check (question_count between 1 and 50),
  add column if not exists time_limit_minutes integer not null default 20 check (time_limit_minutes between 1 and 300),
  add column if not exists attempts_allowed integer not null default 1 check (attempts_allowed between 1 and 100),
  add column if not exists available_from timestamptz,
  add column if not exists due_at timestamptz,
  add column if not exists pass_mark integer not null default 60 check (pass_mark between 0 and 100),
  add column if not exists feedback_timing text not null default 'after_each' check (feedback_timing in ('after_each','after_completion')),
  add column if not exists hints_allowed boolean not null default true,
  add column if not exists skipping_allowed boolean not null default false,
  add column if not exists answer_mode text not null default 'both' check (answer_mode in ('typed','voice','both')),
  add column if not exists instructions text not null default '',
  add column if not exists grounding_mode text not null default 'documents_only' check (grounding_mode in ('documents_only','documents_preferred'));

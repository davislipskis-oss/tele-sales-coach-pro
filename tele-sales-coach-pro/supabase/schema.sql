create extension if not exists pgcrypto;

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  seller text,
  company text,
  call_id text,
  outcome text,
  review_type text,
  coaching_focus text,
  next_actions text,
  notes text,
  transcript text,
  ai_summary text,
  better_phrases jsonb default '[]'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.evaluations enable row level security;

drop policy if exists "Users can view own evaluations" on public.evaluations;
create policy "Users can view own evaluations"
  on public.evaluations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own evaluations" on public.evaluations;
create policy "Users can insert own evaluations"
  on public.evaluations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own evaluations" on public.evaluations;
create policy "Users can update own evaluations"
  on public.evaluations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own evaluations" on public.evaluations;
create policy "Users can delete own evaluations"
  on public.evaluations for delete
  using (auth.uid() = user_id);

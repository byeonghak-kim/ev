
-- Tables
create table public.races (
  id uuid primary key default gen_random_uuid(),
  race_date date not null,
  venue text not null,
  race_no integer not null,
  distance_m integer,
  track_condition text,
  weather text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.horses (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  horse_no integer not null,
  horse_name text not null,
  jockey text,
  trainer text,
  carried_weight numeric,
  sex_age text,
  memo text,
  created_at timestamptz not null default now()
);

create table public.odds_snapshots (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  source text default 'derbyon_screenshot',
  screenshot_url text,
  raw_ocr_json jsonb,
  captured_at timestamptz not null default now(),
  memo text,
  created_at timestamptz not null default now()
);

create table public.odds_entries (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.odds_snapshots(id) on delete cascade,
  race_id uuid not null references public.races(id) on delete cascade,
  bet_type text not null,
  combination_key text not null,
  horse_numbers integer[] not null,
  odds numeric not null,
  ocr_confidence numeric,
  is_manual_edited boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.model_runs (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  model_name text default 'manual_or_sample_model',
  model_version text,
  trained_until date,
  params jsonb,
  memo text,
  created_at timestamptz not null default now()
);

create table public.model_probabilities (
  id uuid primary key default gen_random_uuid(),
  model_run_id uuid not null references public.model_runs(id) on delete cascade,
  race_id uuid not null references public.races(id) on delete cascade,
  bet_type text not null,
  combination_key text not null,
  horse_numbers integer[] not null,
  probability numeric not null,
  memo text,
  created_at timestamptz not null default now()
);

create table public.ev_results (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  snapshot_id uuid not null references public.odds_snapshots(id) on delete cascade,
  model_run_id uuid not null references public.model_runs(id) on delete cascade,
  bet_type text not null,
  combination_key text not null,
  horse_numbers integer[] not null,
  probability numeric not null,
  odds numeric not null,
  implied_probability numeric not null,
  edge numeric not null,
  ev numeric not null,
  ev_percent numeric not null,
  expected_return numeric not null,
  recommendation text,
  rank integer,
  memo text,
  created_at timestamptz not null default now()
);

create table public.app_notes (
  id uuid primary key default gen_random_uuid(),
  race_id uuid references public.races(id) on delete cascade,
  title text,
  body text,
  created_at timestamptz not null default now()
);

-- Indexes
create index on public.horses(race_id);
create index on public.odds_snapshots(race_id);
create index on public.odds_entries(snapshot_id);
create index on public.odds_entries(race_id);
create index on public.model_runs(race_id);
create index on public.model_probabilities(model_run_id);
create index on public.model_probabilities(race_id);
create index on public.ev_results(race_id);

-- Enable RLS with public access (prototype)
alter table public.races enable row level security;
alter table public.horses enable row level security;
alter table public.odds_snapshots enable row level security;
alter table public.odds_entries enable row level security;
alter table public.model_runs enable row level security;
alter table public.model_probabilities enable row level security;
alter table public.ev_results enable row level security;
alter table public.app_notes enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['races','horses','odds_snapshots','odds_entries','model_runs','model_probabilities','ev_results','app_notes']) loop
    execute format('create policy "public_all_select_%1$s" on public.%1$s for select using (true)', t);
    execute format('create policy "public_all_insert_%1$s" on public.%1$s for insert with check (true)', t);
    execute format('create policy "public_all_update_%1$s" on public.%1$s for update using (true) with check (true)', t);
    execute format('create policy "public_all_delete_%1$s" on public.%1$s for delete using (true)', t);
  end loop;
end $$;

-- Storage bucket for screenshots
insert into storage.buckets (id, name, public) values ('odds-screenshots', 'odds-screenshots', true)
on conflict (id) do nothing;

create policy "odds_screenshots_public_select" on storage.objects for select using (bucket_id = 'odds-screenshots');
create policy "odds_screenshots_public_insert" on storage.objects for insert with check (bucket_id = 'odds-screenshots');
create policy "odds_screenshots_public_update" on storage.objects for update using (bucket_id = 'odds-screenshots');
create policy "odds_screenshots_public_delete" on storage.objects for delete using (bucket_id = 'odds-screenshots');

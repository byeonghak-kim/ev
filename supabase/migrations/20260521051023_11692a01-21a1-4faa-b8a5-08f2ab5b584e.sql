
CREATE TABLE public.public_race_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text DEFAULT 'data.go.kr',
  source_unique_key text UNIQUE,
  race_date date,
  venue text,
  race_no integer,
  race_name text,
  distance_m integer,
  horse_no integer,
  horse_name text,
  jockey text,
  trainer text,
  owner_name text,
  rating numeric,
  horse_weight numeric,
  carried_weight numeric,
  sex_age text,
  rank integer,
  race_record text,
  margin text,
  win_odds numeric,
  place_odds numeric,
  quinella_odds numeric,
  weather text,
  track_condition text,
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prr_horse ON public.public_race_results(horse_name);
CREATE INDEX idx_prr_jockey ON public.public_race_results(jockey);
CREATE INDEX idx_prr_trainer ON public.public_race_results(trainer);
CREATE INDEX idx_prr_date ON public.public_race_results(race_date);

ALTER TABLE public.public_race_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_select_prr" ON public.public_race_results FOR SELECT USING (true);
CREATE POLICY "public_all_insert_prr" ON public.public_race_results FOR INSERT WITH CHECK (true);
CREATE POLICY "public_all_update_prr" ON public.public_race_results FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_all_delete_prr" ON public.public_race_results FOR DELETE USING (true);

CREATE TABLE public.public_data_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_started_at timestamptz NOT NULL DEFAULT now(),
  sync_finished_at timestamptz,
  status text,
  target_date_from date,
  target_date_to date,
  fetched_count integer DEFAULT 0,
  inserted_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.public_data_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_select_pdsl" ON public.public_data_sync_logs FOR SELECT USING (true);
CREATE POLICY "public_all_insert_pdsl" ON public.public_data_sync_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "public_all_update_pdsl" ON public.public_data_sync_logs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_all_delete_pdsl" ON public.public_data_sync_logs FOR DELETE USING (true);

CREATE TABLE public.model_update_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_run_id uuid,
  model_name text DEFAULT 'simple_stats_model',
  model_version text,
  status text,
  trained_data_count integer DEFAULT 0,
  generated_probability_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.model_update_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_select_mul" ON public.model_update_logs FOR SELECT USING (true);
CREATE POLICY "public_all_insert_mul" ON public.model_update_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "public_all_update_mul" ON public.model_update_logs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_all_delete_mul" ON public.model_update_logs FOR DELETE USING (true);

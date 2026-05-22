
-- ============================================================
-- 1. 신규 컬럼 추가 (app_session_id, is_deleted)
-- ============================================================
ALTER TABLE public.races            ADD COLUMN IF NOT EXISTS app_session_id text, ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.horses           ADD COLUMN IF NOT EXISTS app_session_id text, ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.odds_snapshots   ADD COLUMN IF NOT EXISTS app_session_id text, ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.odds_entries     ADD COLUMN IF NOT EXISTS app_session_id text, ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.model_runs       ADD COLUMN IF NOT EXISTS app_session_id text, ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.model_probabilities ADD COLUMN IF NOT EXISTS app_session_id text, ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.ev_results       ADD COLUMN IF NOT EXISTS app_session_id text, ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_notes        ADD COLUMN IF NOT EXISTS app_session_id text, ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.public_race_results ADD COLUMN IF NOT EXISTS app_session_id text, ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.public_data_sync_logs ADD COLUMN IF NOT EXISTS app_session_id text, ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.model_update_logs ADD COLUMN IF NOT EXISTS app_session_id text, ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- public_race_results: source_unique_key UNIQUE
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='public_race_results_source_unique_key_uq') THEN
    CREATE UNIQUE INDEX public_race_results_source_unique_key_uq ON public.public_race_results(source_unique_key) WHERE source_unique_key IS NOT NULL;
  END IF;
END $$;

-- ============================================================
-- 2. 기존 정책 전체 삭제
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('races','horses','odds_snapshots','odds_entries','model_runs',
                        'model_probabilities','ev_results','app_notes',
                        'public_race_results','public_data_sync_logs','model_update_logs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 3. RLS 정책 재생성
-- ============================================================
-- SELECT (is_deleted = false)
CREATE POLICY sel_races ON public.races FOR SELECT TO anon, authenticated USING (is_deleted = false);
CREATE POLICY sel_horses ON public.horses FOR SELECT TO anon, authenticated USING (is_deleted = false);
CREATE POLICY sel_odds_snapshots ON public.odds_snapshots FOR SELECT TO anon, authenticated USING (is_deleted = false);
CREATE POLICY sel_odds_entries ON public.odds_entries FOR SELECT TO anon, authenticated USING (is_deleted = false);
CREATE POLICY sel_model_runs ON public.model_runs FOR SELECT TO anon, authenticated USING (is_deleted = false);
CREATE POLICY sel_model_probabilities ON public.model_probabilities FOR SELECT TO anon, authenticated USING (is_deleted = false);
CREATE POLICY sel_ev_results ON public.ev_results FOR SELECT TO anon, authenticated USING (is_deleted = false);
CREATE POLICY sel_app_notes ON public.app_notes FOR SELECT TO anon, authenticated USING (is_deleted = false);
CREATE POLICY sel_prr ON public.public_race_results FOR SELECT TO anon, authenticated USING (is_deleted = false);
CREATE POLICY sel_pdsl ON public.public_data_sync_logs FOR SELECT TO anon, authenticated USING (is_deleted = false);
CREATE POLICY sel_mul ON public.model_update_logs FOR SELECT TO anon, authenticated USING (is_deleted = false);

-- INSERT (app_session_id 유효 + 핵심 컬럼 not null)
CREATE POLICY ins_races ON public.races FOR INSERT TO anon, authenticated
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false
              AND venue IS NOT NULL AND race_date IS NOT NULL AND race_no IS NOT NULL);
CREATE POLICY ins_horses ON public.horses FOR INSERT TO anon, authenticated
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false
              AND race_id IS NOT NULL AND horse_no IS NOT NULL AND horse_name IS NOT NULL);
CREATE POLICY ins_odds_snapshots ON public.odds_snapshots FOR INSERT TO anon, authenticated
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false
              AND race_id IS NOT NULL);
CREATE POLICY ins_odds_entries ON public.odds_entries FOR INSERT TO anon, authenticated
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false
              AND race_id IS NOT NULL AND snapshot_id IS NOT NULL
              AND bet_type IS NOT NULL AND odds IS NOT NULL);
CREATE POLICY ins_model_runs ON public.model_runs FOR INSERT TO anon, authenticated
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false
              AND race_id IS NOT NULL);
CREATE POLICY ins_model_probabilities ON public.model_probabilities FOR INSERT TO anon, authenticated
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false
              AND race_id IS NOT NULL AND model_run_id IS NOT NULL
              AND bet_type IS NOT NULL AND probability IS NOT NULL);
CREATE POLICY ins_ev_results ON public.ev_results FOR INSERT TO anon, authenticated
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false
              AND race_id IS NOT NULL AND snapshot_id IS NOT NULL AND model_run_id IS NOT NULL);
CREATE POLICY ins_app_notes ON public.app_notes FOR INSERT TO anon, authenticated
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false);
CREATE POLICY ins_prr ON public.public_race_results FOR INSERT TO anon, authenticated
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false);
CREATE POLICY ins_pdsl ON public.public_data_sync_logs FOR INSERT TO anon, authenticated
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false);
CREATE POLICY ins_mul ON public.model_update_logs FOR INSERT TO anon, authenticated
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false);

-- UPDATE: 배당률/모델확률만 (사용자 인라인 수정 보존). app_session_id가 있는 row만.
CREATE POLICY upd_odds_entries ON public.odds_entries FOR UPDATE TO anon, authenticated
  USING (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false)
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20);
CREATE POLICY upd_model_probabilities ON public.model_probabilities FOR UPDATE TO anon, authenticated
  USING (app_session_id IS NOT NULL AND length(app_session_id) >= 20 AND is_deleted = false)
  WITH CHECK (app_session_id IS NOT NULL AND length(app_session_id) >= 20);

-- DELETE: 정책 없음 → 전 테이블 익명 DELETE 차단

-- ============================================================
-- 4. Storage: odds-screenshots 비공개화 + 정책 재설정
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'odds-screenshots';

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
           AND (qual::text ILIKE '%odds-screenshots%' OR with_check::text ILIKE '%odds-screenshots%' OR policyname ILIKE '%odds%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- INSERT: 세션 폴더 구조만 허용 ({session-id}/{uuid}.{ext}), 확장자 화이트리스트
CREATE POLICY ins_odds_screenshots ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'odds-screenshots'
    AND (storage.foldername(name))[1] ~ '^[a-zA-Z0-9_-]{20,}$'
    AND (lower(name) LIKE '%.jpg' OR lower(name) LIKE '%.jpeg'
         OR lower(name) LIKE '%.png' OR lower(name) LIKE '%.webp')
  );

-- SELECT: signed URL로만 접근하므로 RLS는 차단 (정책 없음 = 차단)
-- UPDATE/DELETE: 정책 없음 → 차단

-- bucket listing 차단: 정책 없음 (bucket 자체 public=false)

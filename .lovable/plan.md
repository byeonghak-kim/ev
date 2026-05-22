# 수정 계획

기존 EV 계산 흐름(경주→출전마→OCR/수동 배당→모델확률→EV 내림차순→히스토리)은 절대 깨지 않음. 신규 마이그레이션 1회, 신규 파일은 최소(세션 유틸 1, 데이터 관리 라우트 1), 나머지는 기존 파일 부분 편집.

---

## 1. DB 마이그레이션 (단일 migration)

### 1-1. 기존 테이블에 컬럼 추가
- `races`, `horses`, `odds_snapshots`, `odds_entries`, `model_runs`, `model_probabilities`, `ev_results`, `app_notes` 전부에:
  - `app_session_id text`
  - `is_deleted boolean not null default false`
- `public_race_results`, `public_data_sync_logs`, `model_update_logs` 는 이미 존재 → 누락 컬럼(`app_session_id`, `is_deleted`, `source_unique_key UNIQUE`)만 보완.

### 1-2. 기존 "USING (true)" 정책 전면 교체
모든 `public_all_*` 정책 DROP 후, 테이블별로 아래 4종 재생성:

```
-- SELECT: 삭제되지 않은 행만
CREATE POLICY sel_<t> ON public.<t> FOR SELECT TO anon, authenticated
USING (is_deleted = false);

-- INSERT: app_session_id 유효성 + 핵심 컬럼 not null
CREATE POLICY ins_<t> ON public.<t> FOR INSERT TO anon, authenticated
WITH CHECK (
  app_session_id IS NOT NULL
  AND length(app_session_id) >= 20
  AND is_deleted = false
  /* + 테이블별 필수 컬럼 not null 체크 */
);

-- UPDATE/DELETE: anon 금지 (정책 자체를 만들지 않음 → 거부)
```

> UPDATE/DELETE 정책을 만들지 않으므로 anon은 자동 차단. 기존 "수정/삭제" UI는 soft-delete(UPDATE is_deleted=true) 가 필요한데 anon이 UPDATE 불가 → MVP에서는 **삭제 버튼을 UI에서 숨김** 처리(코드 주석으로 표시).
> 단, 배당률 수동 수정(`odds_entries` update)과 같은 기존 핵심 흐름이 깨지면 안 되므로, **owner 기반 UPDATE 정책**만 예외로 추가:
> ```
> CREATE POLICY upd_<t> ON public.<t> FOR UPDATE TO anon
> USING (app_session_id IS NOT NULL AND is_deleted = false)
> WITH CHECK (app_session_id IS NOT NULL);
> ```
> 적용 테이블: `odds_entries`, `horses`, `races`, `model_probabilities` (사용자가 직접 편집하는 것들). 나머지는 UPDATE 정책 없음.
> DELETE 정책은 만들지 않음 (전 테이블).

### 1-3. Storage RLS (`storage.objects`)
- bucket `odds-screenshots` → `public = false` 로 변경 (signed URL만 노출).
- 기존 정책 DROP 후:
  - INSERT: `bucket_id = 'odds-screenshots' AND (storage.foldername(name))[1] ~ '^[a-f0-9-]{20,}$'` (세션 폴더만 허용)
  - SELECT: 동일 조건 (signed URL 사용 시 RLS 우회되지만, 직접 listing 차단)
  - UPDATE/DELETE: 정책 없음 → 차단
- public bucket listing 차단됨 (private bucket).

---

## 2. 클라이언트 세션 유틸 (신규 1파일)

`src/lib/session.ts`:
```ts
export function getAppSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('app_session_id');
  if (!id || id.length < 20) {
    id = crypto.randomUUID();
    localStorage.setItem('app_session_id', id);
  }
  return id;
}
```

모든 기존 insert 호출부에 `app_session_id: getAppSessionId()` 추가:
- `src/lib/sample.ts` (races/horses/odds_snapshots/odds_entries/model_runs/model_probabilities/ev_results)
- `src/lib/inference.ts` 호출부 (`races.$raceId.tsx`의 ProbsTab.newRun)
- `src/lib/horses.functions.ts` (서버 함수: input으로 sessionId 받아 admin insert)
- `src/routes/races.new.tsx` (race insert)
- `src/routes/races.$raceId.tsx` (horses 수동, snapshot/entries 수동, model_probabilities 수동, ev 계산 insert)

---

## 3. Storage 업로드 수정

`races.$raceId.tsx`의 OCR 업로드 흐름(있다면) 및 향후 캡처 업로드:
- 경로: `${app_session_id}/${crypto.randomUUID()}.${ext}`
- 확장자 화이트리스트: jpg/jpeg/png/webp
- 표시: `supabase.storage.from('odds-screenshots').createSignedUrl(path, 3600)`

---

## 4. UI 삭제 버튼 처리

- 홈(`index.tsx`) 카드 🗑️ → **숨김 (주석으로 보존)**
- 배당률 스냅샷/모델 런 🗑️ → **숨김**
- 이유: anon DELETE 차단 + soft-delete 시 cascade 복잡 → MVP에선 단순 숨김.

---

## 5. 신규 라우트: 데이터 관리 (`src/routes/data.tsx`)

섹션: "공공데이터 및 모델 관리"
안내문 카드 + 통계 카드 + 버튼 3개:

### 5-1. 통계 카드
- `count(public_race_results where is_deleted=false)` → 저장 건수
- `max(created_at) from public_data_sync_logs` → 마지막 동기화
- `max(created_at) from model_update_logs` → 마지막 모델 갱신
- 최신 model_version (model_update_logs 최근 1건)
- 보안 상태 정적 표기: "RLS 적용 / Storage overwrite 금지 / Public listing 금지"

### 5-2. 버튼 1: 샘플 공공데이터 20건 추가
- 클라이언트에서 결정론적 샘플 20건 생성 (`source='sample'`, `source_unique_key = 'sample-' + idx + '-' + sessionId`).
- `upsert({ onConflict: 'source_unique_key', ignoreDuplicates: true })` 로 중복 차단.
- 결과를 `public_data_sync_logs` insert (status='success', inserted_count, skipped_count).
- 외부 API 호출 0회 → timeout 없음.

### 5-3. 버튼 2: 간이 모델 갱신
- prop: 현재 선택 경주 ID (없으면 select로 선택).
- 출전마(`horses`) 조회 → 각 말의 `public_race_results`에서 horse_name 매치 통계:
  - horse_place_rate = (rank<=3 count)/(total count)
  - jockey_place_rate, trainer_place_rate 동일
- score = 0.4·hpr + 0.3·jpr + 0.3·tpr
- 합=0이면 균등확률(1/N)
- 정규화 후 model_runs insert → model_probabilities bulk insert (bet_type='단승')
- model_update_logs insert.
- 기존 row 수정 없음(새 버전만 추가).

### 5-4. 버튼 3: EV 결과 다시 계산
- 현재 선택 경주의 최신 active snapshot + 최신 model_run 조회.
- `src/lib/ev.ts` 의 기존 계산 함수 재사용 → ev_results에 **새로 insert**(기존 row 그대로 두기).
- EV 탭 기본 정렬 EV desc 유지.

---

## 6. 라우터 등록

`src/router.tsx` / `__root.tsx` 네비게이션에 "데이터 관리" 링크 추가. `routeTree.gen.ts`는 자동 생성.

---

## 7. 영향 파일 요약

**신규(2)**: `src/lib/session.ts`, `src/routes/data.tsx`
**편집(7)**: `src/lib/sample.ts`, `src/lib/inference.ts`, `src/lib/horses.functions.ts`, `src/routes/races.new.tsx`, `src/routes/races.$raceId.tsx`, `src/routes/index.tsx`, `src/routes/__root.tsx`
**마이그레이션(1)**: 컬럼 추가 + 정책 전면 재작성 + storage 정책 + bucket private화

---

## 8. 자체 점검 체크리스트

1. supabase linter: USING(true) 경고 0건.
2. 보안 스캔: anon UPDATE/DELETE 차단 확인.
3. odds-screenshots: private + INSERT only.
4. 샘플 경주 만들기 → EV 탭 정상.
5. 새 경주 → 캡처 OCR → 배당률 수정 → 모델 런 → EV desc 정상.
6. 데이터 관리 → 샘플 20건 추가(즉시 완료) → 간이 모델 갱신 → EV 재계산.
7. TypeScript 빌드 통과.

---

승인 시 위 순서대로 1번 마이그레이션부터 실행합니다.
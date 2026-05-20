# 수정 구현 계획 (3건)

크레딧 절약 원칙: 신규 마이그레이션 0회, 신규 npm 패키지 0개. 신규 파일은 꼭 필요한 1개(서버 함수)만 추가, 나머지는 기존 파일 부분 편집.

영향 파일
- `src/lib/horses.functions.ts` (신규 1개, 서버 함수 — OCR 호출)
- `src/lib/inference.ts` (신규 1개, 순수 함수 — 자동 추론 로직, 테스트·재사용 가능)
- `src/routes/races.$raceId.tsx` (HorsesTab에 업로드 버튼, ProbsTab의 `newRun()` 자동화)
- `src/routes/help.tsx` (모델 확률 설명 + 후보 개수 설명 추가)

DB/패키지/마이그레이션 변경 없음.

---

## 수정사항 1: 출전마 자동 입력 (더비온 캡처 OCR)

현재 `HorsesTab`은 한 줄씩 수동 입력만 가능. 사용자는 캡처 한 장에서 8~16두를 한 번에 채우기를 원함.

접근: Lovable AI Gateway의 비전 모델(`google/gemini-2.5-flash`, 무료 크레딧 범위)을 서버 함수로 호출. 파일 업로드 → base64로 변환 → 모델에 “마번/마명/기수/조교사/부담중량/성별연령 JSON 배열로만 응답” 프롬프트 → 결과 파싱 → `horses` 일괄 insert.

구현:
- `src/lib/horses.functions.ts` (신규)
  - `extractHorsesFromImage = createServerFn({ method: "POST" })`
  - input: `{ raceId: string, imageBase64: string, mimeType: string }`
  - handler: `LOVABLE_API_KEY`로 `https://ai.gateway.lovable.dev/v1/chat/completions` 호출, JSON 강제(`response_format: { type: "json_object" }`), 스키마 검증 후 supabaseAdmin으로 horses에 bulk insert. race_id별로 horse_no 중복 시 스킵.
- `src/routes/races.$raceId.tsx` HorsesTab
  - "캡처에서 출전마 자동 채우기" 버튼 + 숨겨진 파일 input. 업로드 시 FileReader로 base64 변환 → `useServerFn(extractHorsesFromImage)` 호출 → 성공 시 `onChanged()`로 새로고침.
  - OCR 실패/일부 누락 시 기존 수동 추가 폼이 그대로 보조 입력으로 작동(요구사항: OCR 실패해도 수동 진행 가능).
- `start.ts`의 `attachSupabaseAuth`는 인증 없이 호출되므로 `requireSupabaseAuth` 미들웨어는 사용하지 않음(앱 자체가 무인증).

비용/크레딧 절약 포인트
- 이미지 한 장당 1회 호출. 별도 OCR 패키지 없음.
- 파일 저장(스토리지 버킷) 없이 base64 그대로 모델에 전달 → 마이그레이션 0.

---

## 수정사항 2: "새 모델 런" 클릭 시 자동 추론

현재 `ProbsTab.newRun()`은 빈 `model_runs` row만 생성 → ProbsTab/EvTab가 비어 있음. 사용자가 수동 입력해야 EV가 나옴. 요구사항: 출전마 + 배당률만 있으면 새 모델 런 클릭 한 번으로 EV 결과까지 즉시.

접근: 외부 AI 호출 없이 **결정론적·순수 함수 모델**로 충분. 활성 배당률 스냅샷의 단승 odds로 시장 암시 확률 → 오버라운드 제거 → 각 베팅 종목 후보 자동 생성.

구현:
- `src/lib/inference.ts` (신규, 순수 TS 함수)
  - `inferProbabilities(horses, singleWinOdds[]) → ModelProbInput[]`
  - 단계
    1. 단승 odds로 `p_i = (1/odds_i) / Σ(1/odds_j)` (오버라운드 정규화).
    2. **단승**: N개 (각 마번).
    3. **연승**(3위 이내): Harville 근사 `P_top3(i) ≈ p_i + Σ_{j≠i} p_i/(1−p_j) · p_j/(1−p_j) + ...` — 정확도보다 합리적 순위 부여가 목표이므로 단순화 가능.
    4. **복승**(1·2위, 무순): 모든 쌍 C(N,2). `P({i,j}) = p_i·p_j/(1−p_i) + p_j·p_i/(1−p_j)`.
    5. **쌍승**(1·2위, 유순): P(N,2). `P(i→j) = p_i · p_j/(1−p_i)`.
    6. **복연승**(연승의 페어, 1~3위 중 2마리): C(N,2). Harville 1·2·3위 확률을 합산.
    7. **삼복승**(1~3위 무순): C(N,3). 위와 동일.
    8. **삼쌍승**(1~3위 유순): P(N,3). 상위 K(=12) 마번 조합만 산출(전체 720은 과다).
  - 각 종목별 총합은 1에 가깝게(완전히 같지는 않음을 명시) 보정.
- `ProbsTab.newRun()` 수정
  - 새 model_run insert.
  - 활성 odds 스냅샷 조회 → 단승 entries 추출. 8두 단승이 다 있으면 `inferProbabilities` 실행 → 결과를 `model_probabilities`에 bulk insert.
  - 단승 entry가 없으면 빈 런만 만들고 toast로 "단승 배당이 없어 자동 추론 생략, 수동 입력하세요" 안내.
  - 완료 후 자동 reload + setActiveRun → EV 탭에서 즉시 결과 확인 가능.

크레딧 절약 포인트
- 외부 API 호출 0회. 순수 TS만으로 동작.
- 후보 폭발 방지: 삼쌍승만 상위 K로 제한(N=12일 때 720→12·11·10/... 적정 cap).

---

## 수정사항 3: 도움말 보강 + 후보 개수 설명

현재 `help.tsx`에 모델 확률 정의가 없고, 사용자는 "샘플 경주의 16개 후보 = 시스템 한계"로 오해.

구현 (`src/routes/help.tsx`에 카드 2개 추가, 기존 카드는 유지):
- **모델 확률이란?** 카드
  - "모델 확률 = 해당 베팅이 적중할 것으로 추정한 확률(0~1). 사용자가 직접 입력하거나, '새 모델 런' 버튼으로 단승 배당률 기반 자동 추론을 사용할 수 있음."
  - "배당률의 암시확률(1/odds)과 다름: 시장 컨센서스가 아닌 본인/모델의 예측 확률."
- **후보 개수에 대하여** 카드
  - N두 경주에서 종목별 이론 후보 수 표:
    - 단승 N, 연승 N, 복승 C(N,2), 쌍승 P(N,2), 복연승 C(N,3), 삼복승 C(N,3), 삼쌍승 P(N,3)
    - 예: N=12 → 12+12+66+132+220+220+1320 ≈ 약 1980개.
  - "샘플 경주는 데모 목적으로 단승+복승만 16개를 생성. 실제 경주에서 '새 모델 런'을 누르면 출전 두수에 맞춰 자동으로 모든 종목 후보가 생성되며, 삼쌍승은 조합 폭발을 막기 위해 상위 K개로 제한함."

---

## 기술 상세

### 서버 함수 등록
- `src/start.ts`의 `functionMiddleware`는 그대로 둠(인증 미사용이므로 `attachSupabaseAuth`가 필수는 아니나 기존 설정 보존).
- `extractHorsesFromImage`는 `requireSupabaseAuth` 없이 정의.

### Lovable AI Gateway 호출 (수정사항 1)
```ts
const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [{ role: "user", content: [
      { type: "text", text: "한국 경마 출전표 캡처. 각 행의 마번/마명/기수/조교사/부담중량/성별연령을 JSON 배열로만 반환." },
      { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
    ]}],
    response_format: { type: "json_object" },
  }),
});
```
- 비용은 LOVABLE 무료 크레딧 범위.

### 추론 알고리즘 정확도
- 목표는 정확 예측이 아니라 EV 비교용 일관된 확률 부여. Harville 모델로 충분.
- 사용자가 결과 부정확하다고 느끼면 기존 수동 입력/CSV import로 덮어쓰기 가능.

### 후보 폭발 가드
- N(출전 두수) ≥ 14면 삼쌍승은 상위 K=12 자동 절단, 토스트로 안내.
- DB는 race_id 기반 인덱스만 사용; 1런당 약 2000행 insert는 단일 insert(array)로 처리.

---

## 확인 방법
1. 새 경주 생성 → 출전마 탭에서 더비온 캡처 업로드 → 자동 채워짐.
2. 배당률 탭에서 단승 배당 입력/스냅샷 만든 후, 모델 확률 탭의 "새 모델 런" 클릭 → 즉시 수백 개 후보 생성, EV 탭에서 EV 내림차순 확인.
3. 도움말 페이지에서 모델 확률 정의·후보 개수 설명 카드 노출.
4. 신규 마이그레이션·패키지 없음, TypeScript 빌드 통과.

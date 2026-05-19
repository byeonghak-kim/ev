
크레딧을 아끼기 위해 4개 수정사항을 **단일 메시지·최소 파일 편집**으로 묶어 처리합니다. DB 마이그레이션은 필요 없고(기존 테이블·RLS로 충분), 기존 파일 3개만 부분 편집합니다.

## 영향 범위
- `src/lib/sample.ts` — 샘플 생성 견고화 (수정사항 1)
- `src/routes/races.new.tsx` — 주로/날씨 Select 변환 (수정사항 2)
- `src/routes/races.$raceId.tsx` — EV 필터 기본값, 모델 확률/배당률 삭제 (수정사항 3, 4)
- `src/routes/index.tsx` + `src/routes/history.tsx` — 최근 경주 삭제 버튼 (수정사항 4, history는 이미 존재하므로 index에만 추가)

신규 파일 없음, 신규 패키지 없음, 신규 마이그레이션 없음 → 크레딧 절약.

## 수정사항 1: 샘플 경주 무결성 보장
현재 `createSampleRace()`는 각 insert의 `error`를 일부만 확인하고, 실패해도 race만 만들어진 채 EV 탭이 깨집니다.

`src/lib/sample.ts` 변경:
- 모든 insert에 `.select()` + `error` 체크 추가, 실패 시 즉시 `throw`.
- 실패 시 롤백: try/catch에서 race를 `delete()` (RLS public이므로 가능). cascade가 없으므로 horses/odds_entries/snapshots/model_runs/model_probabilities를 race_id로 모두 정리.
- 함수 마지막에 sanity check: race_id로 horses(=8), odds_entries(>0, 단승+복승), model_probabilities(>0)를 `select count`로 재조회해 0이면 throw.
- 추가로 단승 8두 배당률·확률은 **반드시 모두 삽입**되도록 `Promise.all` 대신 단일 `insert(array)`의 결과 length 검증.

(선택, 무료) `EvTab` 진입 시 배당률 또는 확률이 비어 있으면 안내 카드를 더 강조 — 이미 일부 안내가 있어 신규 코드 최소.

## 수정사항 2: 새 경주 - 주로 상태 / 날씨 Select화
실시간 외부 데이터 크롤링은 비용·신뢰성·CORS 문제로 부적합 → **고정 후보 Select**로 단순화 (사용자 요구사항 "후보 중 선택 가능"에 부합).

`src/routes/races.new.tsx`:
- `track_condition` Input → Select: `양호 / 다습 / 포화 / 불량` 옵션.
- `weather` Input → Select: `맑음 / 흐림 / 비 / 눈 / 안개` 옵션.
- 기존 Select 컴포넌트(이미 import됨) 재사용.

## 수정사항 3: "EV 양수만 보기" 기본 OFF
`src/routes/races.$raceId.tsx` line 955:
```
const [onlyPositive, setOnlyPositive] = useState(true);
```
→ `useState(false)`로 변경. (한 줄 수정)

라벨 "EV 양수 후보" KPI 카드는 양수 개수만 보여주는 카운터이므로 그대로 둠.

## 수정사항 4: 삭제 기능 추가
현재 상태:
- **출전마**: 이미 삭제 가능 (HorsesTab의 Trash2 버튼).
- **배당률 entry**: 이미 삭제 가능 (`removeEntry`).
- **모델 확률 prob**: 이미 삭제 가능 (`setProbs((prev) => prev.filter)` 부분, line 771).
- **경주(히스토리)**: `history.tsx`에 이미 삭제 가능.
- **누락**: 
  - (a) **배당률 스냅샷 전체 삭제** — 잘못 만든 빈 스냅샷/스크린샷 단위 삭제.
  - (b) **모델 실행(model_run) 전체 삭제** — 잘못 입력한 확률 세트 통째 삭제.
  - (c) **홈 화면 "최근 경주"에서 바로 삭제** — 현재 클릭만 가능.

`src/routes/races.$raceId.tsx`:
- OddsTab 스냅샷 칩 옆에 Trash2 아이콘 추가. 클릭 시 `confirm` → `odds_snapshots delete` + 같은 snapshot_id의 `odds_entries`도 삭제(cascade 없음). 활성 스냅샷이면 다음 스냅샷으로 전환.
- ProbsTab의 모델 실행 선택 영역에 Trash2 추가. `model_runs delete` + 동일 run_id의 `model_probabilities` 삭제.

`src/routes/index.tsx`:
- 각 RaceCard에 작은 Trash2 아이콘 버튼 추가 (Link와 별도 위치, e.stopPropagation/preventDefault). 클릭 시 `races` 삭제 + 관련 horses/odds_snapshots/odds_entries/model_runs/model_probabilities/ev_results를 race_id로 일괄 삭제. history.tsx 패턴 재사용.

(권장 개선, 추후) DB ON DELETE CASCADE 마이그레이션 한 번 돌리면 클라이언트 정리 코드가 모두 사라지지만, **이번 크레딧 절약 모드에서는 클라이언트 측 다중 delete로 충분**.

## 실행 순서 (단일 턴, 마이그레이션 0회)
1. `sample.ts` 재작성 (수정사항 1).
2. `races.new.tsx`에서 두 필드 Select화 (수정사항 2).
3. `races.$raceId.tsx`에서 한 줄(기본값) + 스냅샷/모델런 삭제 버튼 (수정사항 3, 4 일부).
4. `index.tsx`에 삭제 버튼 + 일괄 정리 함수 (수정사항 4 나머지).

총 4개 파일 수정, 마이그레이션·신규 의존성 0. 한 번의 응답으로 처리 가능.

## 확인 방법
- 샘플 생성 → 바로 EV 탭에 결과가 보이는지.
- 새 경주 폼에서 주로/날씨가 드롭다운으로 보이는지.
- EV 탭 첫 진입 시 모든 후보(음수 포함) 표시, 스위치 ON 시 양수만.
- 홈/배당률 스냅샷/모델런/경주 모두 삭제 가능, 삭제 후 잔여 row 없는지.

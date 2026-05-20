// 단승 배당률 기반 결정론적 확률 추론.
// 외부 AI 호출 없이 시장 단승 배당 → 정규화 강도 → Harville 모델로
// 모든 베팅 종목 후보를 생성한다.

import { combinationKey, type BetType } from "./ev";

export type InferenceInput = {
  // horse_no -> 단승 배당률
  singleWinOdds: Map<number, number>;
};

export type InferredProb = {
  bet_type: BetType;
  combination_key: string;
  horse_numbers: number[];
  probability: number;
};

// 한 런당 최대 행 수 가드 (DB insert 한도/UX 고려)
const MAX_PER_TYPE = 400;

export function inferProbabilities(input: InferenceInput): InferredProb[] {
  const entries = [...input.singleWinOdds.entries()]
    .filter(([, o]) => Number.isFinite(o) && o > 0)
    .sort((a, b) => a[0] - b[0]);
  if (entries.length < 2) return [];

  const horseNos = entries.map(([n]) => n);
  // 시장 강도 = 1/odds, 오버라운드 제거 위해 정규화
  const raw = entries.map(([, o]) => 1 / o);
  const sum = raw.reduce((s, x) => s + x, 0);
  const q = raw.map((x) => x / sum); // P(i wins)
  const N = horseNos.length;

  const idxOf = new Map<number, number>();
  horseNos.forEach((n, i) => idxOf.set(n, i));

  const out: InferredProb[] = [];

  // 단승: P(i wins) = q_i
  for (let i = 0; i < N; i++) {
    out.push({
      bet_type: "단승",
      combination_key: combinationKey("단승", [horseNos[i]]),
      horse_numbers: [horseNos[i]],
      probability: q[i],
    });
  }

  // 순서 있는 상위 3 (a,b,c) Harville 확률을 한 번에 계산해 모든 종목에 활용
  // p(a,b,c) = q_a * q_b/(1-q_a) * q_c/(1-q_a-q_b)
  type Triple = { a: number; b: number; c: number; p: number };
  const triples: Triple[] = [];
  for (let a = 0; a < N; a++) {
    const da = 1 - q[a];
    if (da <= 0) continue;
    for (let b = 0; b < N; b++) {
      if (b === a) continue;
      const dab = 1 - q[a] - q[b];
      if (dab <= 0) continue;
      const pab = q[a] * (q[b] / da);
      for (let c = 0; c < N; c++) {
        if (c === a || c === b) continue;
        const p = pab * (q[c] / dab);
        if (p > 0) triples.push({ a, b, c, p });
      }
    }
  }

  // 연승: P(i in top 3) = Σ triples where i ∈ {a,b,c}
  const yeon = new Array<number>(N).fill(0);
  // 복승 (top2 unordered): {a,b}
  const bok = new Map<string, { nums: number[]; p: number }>();
  // 쌍승 (top2 ordered): (a→b)
  const ssang = new Map<string, { nums: number[]; p: number }>();
  // 복연승 (any 2 of top 3, unordered)
  const bokyeon = new Map<string, { nums: number[]; p: number }>();
  // 삼복승 (top3 unordered)
  const samBok = new Map<string, { nums: number[]; p: number }>();
  // 삼쌍승 (top3 ordered)
  const samSsang = new Map<string, { nums: number[]; p: number }>();

  const addTo = (
    map: Map<string, { nums: number[]; p: number }>,
    bet_type: BetType,
    nums: number[],
    p: number,
  ) => {
    const key = combinationKey(bet_type, nums);
    const cur = map.get(key);
    if (cur) cur.p += p;
    else map.set(key, { nums, p });
  };

  for (const t of triples) {
    const aN = horseNos[t.a];
    const bN = horseNos[t.b];
    const cN = horseNos[t.c];
    yeon[t.a] += t.p;
    yeon[t.b] += t.p;
    yeon[t.c] += t.p;

    // 복승: {a,b}
    addTo(bok, "복승", [aN, bN], t.p);
    // 쌍승: (a→b)
    addTo(ssang, "쌍승", [aN, bN], t.p);
    // 복연승: 세 쌍 {a,b},{a,c},{b,c} 각각
    addTo(bokyeon, "복연승", [aN, bN], t.p);
    addTo(bokyeon, "복연승", [aN, cN], t.p);
    addTo(bokyeon, "복연승", [bN, cN], t.p);
    // 삼복승: {a,b,c}
    addTo(samBok, "삼복승", [aN, bN, cN], t.p);
    // 삼쌍승: (a→b→c)
    addTo(samSsang, "삼쌍승", [aN, bN, cN], t.p);
  }

  for (let i = 0; i < N; i++) {
    out.push({
      bet_type: "연승",
      combination_key: combinationKey("연승", [horseNos[i]]),
      horse_numbers: [horseNos[i]],
      probability: yeon[i],
    });
  }

  const pushMap = (
    map: Map<string, { nums: number[]; p: number }>,
    bet_type: BetType,
  ) => {
    const arr = [...map.entries()]
      .map(([key, v]) => ({
        bet_type,
        combination_key: key,
        horse_numbers: v.nums,
        probability: v.p,
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, MAX_PER_TYPE);
    out.push(...arr);
  };

  pushMap(bok, "복승");
  pushMap(ssang, "쌍승");
  pushMap(bokyeon, "복연승");
  pushMap(samBok, "삼복승");
  pushMap(samSsang, "삼쌍승");

  return out;
}

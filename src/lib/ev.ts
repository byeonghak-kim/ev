// EV 계산 및 포맷터

export type BetType =
  | "단승"
  | "연승"
  | "복승"
  | "쌍승"
  | "복연승"
  | "삼복승"
  | "삼쌍승";

export const BET_TYPES: BetType[] = [
  "단승",
  "연승",
  "복승",
  "쌍승",
  "복연승",
  "삼복승",
  "삼쌍승",
];

export type Recommendation = "강한 후보" | "후보" | "관찰" | "제외";

export function recommendation(ev: number): Recommendation {
  if (ev <= 0) return "제외";
  if (ev <= 0.1) return "관찰";
  if (ev <= 0.25) return "후보";
  return "강한 후보";
}

export function recommendationVariant(rec: Recommendation): string {
  switch (rec) {
    case "강한 후보":
      return "bg-success text-success-foreground";
    case "후보":
      return "bg-primary text-primary-foreground";
    case "관찰":
      return "bg-warning text-warning-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function calcEv(probability: number, odds: number) {
  const implied = odds > 0 ? 1 / odds : 0;
  const ev = probability * odds - 1;
  return {
    implied_probability: implied,
    edge: probability - implied,
    ev,
    ev_percent: ev * 100,
    expected_return: probability * odds,
    recommendation: recommendation(ev),
  };
}

export const fmtPct = (n: number, digits = 1) =>
  `${(n * 100).toFixed(digits)}%`;
export const fmtOdds = (n: number) => n.toFixed(2);
export const fmtEvPct = (n: number) => {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
};
export const fmtNum = (n: number, digits = 2) => n.toFixed(digits);

// 조합 key 정규화 (마번 배열을 sort 후 "-" 결합)
export function combinationKey(bet_type: BetType, horse_numbers: number[]) {
  // 단승/연승 등 순서가 없는 종목과 쌍승(순서 있음) 구분
  const ordered = bet_type === "쌍승" || bet_type === "삼쌍승";
  const arr = ordered
    ? [...horse_numbers]
    : [...horse_numbers].sort((a, b) => a - b);
  return arr.join("-");
}

export function parseHorseNumbers(input: string): number[] {
  return input
    .split(/[,\-\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

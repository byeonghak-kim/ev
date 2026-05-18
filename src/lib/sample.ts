import { supabase } from "@/integrations/supabase/client";
import { combinationKey, type BetType } from "./ev";

const VENUES = ["서울", "부산경남", "제주"];
const HORSE_NAMES = [
  "천둥의질주",
  "별빛질주",
  "한강의기적",
  "황금나래",
  "은빛질주",
  "북두칠성",
  "푸른바람",
  "백두대간",
];

export async function createSampleRace(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: race, error: rErr } = await supabase
    .from("races")
    .insert({
      race_date: today,
      venue: VENUES[Math.floor(Math.random() * VENUES.length)],
      race_no: Math.floor(Math.random() * 12) + 1,
      distance_m: 1400,
      track_condition: "양호",
      weather: "맑음",
      memo: "샘플 경주 (자동 생성)",
    })
    .select("id")
    .single();
  if (rErr || !race) throw rErr;
  const raceId = race.id;

  // 8 horses
  const horses = HORSE_NAMES.map((name, i) => ({
    race_id: raceId,
    horse_no: i + 1,
    horse_name: name,
    jockey: `기수${i + 1}`,
    trainer: `조교사${i + 1}`,
    carried_weight: 55 + (i % 3),
    sex_age: i % 2 === 0 ? "수4" : "암4",
  }));
  await supabase.from("horses").insert(horses);

  // odds snapshot - 단승 + 복승
  const { data: snap } = await supabase
    .from("odds_snapshots")
    .insert({
      race_id: raceId,
      source: "sample_generator",
      memo: "샘플 배당률",
    })
    .select("id")
    .single();
  if (!snap) throw new Error("snapshot 생성 실패");

  const oddsRows: Array<{
    snapshot_id: string;
    race_id: string;
    bet_type: BetType;
    combination_key: string;
    horse_numbers: number[];
    odds: number;
    ocr_confidence: number;
    is_manual_edited: boolean;
  }> = [];
  // 단승 8개
  const winOdds = [2.5, 3.8, 5.0, 6.2, 8.5, 12.0, 18.0, 25.0];
  winOdds.forEach((o, i) => {
    const nums = [i + 1];
    oddsRows.push({
      snapshot_id: snap.id,
      race_id: raceId,
      bet_type: "단승",
      combination_key: combinationKey("단승", nums),
      horse_numbers: nums,
      odds: o,
      ocr_confidence: 0.95,
      is_manual_edited: false,
    });
  });
  // 복승 일부 (1-2, 1-3, 2-3, 1-4, 2-4, 3-4)
  const exactaCombos: Array<[number, number, number]> = [
    [1, 2, 7.5],
    [1, 3, 9.0],
    [2, 3, 12.5],
    [1, 4, 11.0],
    [2, 4, 14.0],
    [3, 4, 18.0],
    [1, 5, 16.0],
    [3, 5, 22.0],
  ];
  exactaCombos.forEach(([a, b, o]) => {
    const nums = [a, b];
    oddsRows.push({
      snapshot_id: snap.id,
      race_id: raceId,
      bet_type: "복승",
      combination_key: combinationKey("복승", nums),
      horse_numbers: nums,
      odds: o,
      ocr_confidence: 0.9,
      is_manual_edited: false,
    });
  });
  await supabase.from("odds_entries").insert(oddsRows);

  // model run + probabilities
  const { data: run } = await supabase
    .from("model_runs")
    .insert({
      race_id: raceId,
      model_name: "sample_model",
      model_version: "v0.1",
      memo: "샘플 확률",
    })
    .select("id")
    .single();
  if (!run) throw new Error("model_run 생성 실패");

  // 단승 확률 (합 = 1)
  const winProbs = [0.25, 0.2, 0.16, 0.12, 0.1, 0.08, 0.05, 0.04];
  const probRows = winProbs.map((p, i) => ({
    model_run_id: run.id,
    race_id: raceId,
    bet_type: "단승" as BetType,
    combination_key: combinationKey("단승", [i + 1]),
    horse_numbers: [i + 1],
    probability: p,
  }));
  // 복승 확률 (대략적)
  const exactaProbs: Array<[number, number, number]> = [
    [1, 2, 0.13],
    [1, 3, 0.1],
    [2, 3, 0.08],
    [1, 4, 0.085],
    [2, 4, 0.07],
    [3, 4, 0.06],
    [1, 5, 0.07],
    [3, 5, 0.045],
  ];
  exactaProbs.forEach(([a, b, p]) => {
    probRows.push({
      model_run_id: run.id,
      race_id: raceId,
      bet_type: "복승",
      combination_key: combinationKey("복승", [a, b]),
      horse_numbers: [a, b],
      probability: p,
    });
  });
  await supabase.from("model_probabilities").insert(probRows);

  return raceId;
}

import { supabase } from "@/integrations/supabase/client";
import { combinationKey, type BetType } from "./ev";
import { getAppSessionId } from "./session";

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

async function softDeleteRace(raceId: string, sid: string) {
  // 익명 DELETE는 차단되어 있고 UPDATE 정책도 없는 테이블이 많으므로 best-effort soft-delete만 시도.
  // (실제로는 별다른 정리가 안 되어도 race 자체는 그대로 두면 무해.)
  await supabase.from("races").update({ is_deleted: true }).eq("id", raceId).eq("app_session_id", sid);
}

export async function createSampleRace(): Promise<string> {
  const sid = getAppSessionId();
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
      app_session_id: sid,
    })
    .select("id")
    .single();
  if (rErr || !race) throw rErr ?? new Error("race 생성 실패");
  const raceId = race.id;

  try {
    // 1) 8 horses
    const horses = HORSE_NAMES.map((name, i) => ({
      race_id: raceId,
      horse_no: i + 1,
      horse_name: name,
      jockey: `기수${i + 1}`,
      trainer: `조교사${i + 1}`,
      carried_weight: 55 + (i % 3),
      sex_age: i % 2 === 0 ? "수4" : "암4",
      app_session_id: sid,
    }));
    const { data: hData, error: hErr } = await supabase
      .from("horses")
      .insert(horses)
      .select("id");
    if (hErr) throw hErr;
    if (!hData || hData.length !== 8) throw new Error("출전마 삽입 실패");

    // 2) odds snapshot
    const { data: snap, error: sErr } = await supabase
      .from("odds_snapshots")
      .insert({
        race_id: raceId,
        source: "sample_generator",
        memo: "샘플 배당률",
        app_session_id: sid,
      })
      .select("id")
      .single();
    if (sErr || !snap) throw sErr ?? new Error("snapshot 생성 실패");

    // 3) odds entries (단승 8 + 복승 8)
    const oddsRows: Array<{
      snapshot_id: string;
      race_id: string;
      bet_type: BetType;
      combination_key: string;
      horse_numbers: number[];
      odds: number;
      ocr_confidence: number;
      is_manual_edited: boolean;
      app_session_id: string;
    }> = [];
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
        app_session_id: sid,
      });
    });
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
        app_session_id: sid,
      });
    });
    const { data: oData, error: oErr } = await supabase
      .from("odds_entries")
      .insert(oddsRows)
      .select("id");
    if (oErr) throw oErr;
    if (!oData || oData.length !== oddsRows.length)
      throw new Error("배당률 항목 삽입 실패");

    // 4) model run
    const { data: run, error: mrErr } = await supabase
      .from("model_runs")
      .insert({
        race_id: raceId,
        model_name: "sample_model",
        model_version: "v0.1",
        memo: "샘플 확률",
        app_session_id: sid,
      })
      .select("id")
      .single();
    if (mrErr || !run) throw mrErr ?? new Error("model_run 생성 실패");

    // 5) model probabilities (단승 8 + 복승 8)
    const winProbs = [0.25, 0.2, 0.16, 0.12, 0.1, 0.08, 0.05, 0.04];
    const probRows: Array<{
      model_run_id: string;
      race_id: string;
      bet_type: BetType;
      combination_key: string;
      horse_numbers: number[];
      probability: number;
      app_session_id: string;
    }> = winProbs.map((p, i) => ({
      model_run_id: run.id,
      race_id: raceId,
      bet_type: "단승",
      combination_key: combinationKey("단승", [i + 1]),
      horse_numbers: [i + 1],
      probability: p,
      app_session_id: sid,
    }));
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
        app_session_id: sid,
      });
    });
    const { data: pData, error: pErr } = await supabase
      .from("model_probabilities")
      .insert(probRows)
      .select("id");
    if (pErr) throw pErr;
    if (!pData || pData.length !== probRows.length)
      throw new Error("모델 확률 삽입 실패");

    // 6) sanity check
    const [hCount, oCount, pCount] = await Promise.all([
      supabase.from("horses").select("id", { count: "exact", head: true }).eq("race_id", raceId),
      supabase.from("odds_entries").select("id", { count: "exact", head: true }).eq("race_id", raceId),
      supabase.from("model_probabilities").select("id", { count: "exact", head: true }).eq("race_id", raceId),
    ]);
    if ((hCount.count ?? 0) < 8) throw new Error("출전마 검증 실패");
    if ((oCount.count ?? 0) < 1) throw new Error("배당률 검증 실패");
    if ((pCount.count ?? 0) < 1) throw new Error("모델 확률 검증 실패");

    return raceId;
  } catch (err) {
    // best-effort soft-rollback (실제로는 cascade 정리는 RLS상 불가)
    await softDeleteRace(raceId, sid).catch(() => undefined);
    throw err;
  }
}

// 데이터 관리 화면 보조 함수: 샘플 공공데이터 추가, 간이 모델 갱신, EV 재계산.
// 외부 API/엣지 함수 호출 없이 클라이언트에서 직접 supabase에 insert만 수행한다.
import { supabase } from "@/integrations/supabase/client";
import { getAppSessionId } from "./session";
import { calcEv, combinationKey, type BetType } from "./ev";

const SAMPLE_VENUES = ["서울", "부산경남", "제주"];
const SAMPLE_HORSES = [
  "천둥의질주", "별빛질주", "한강의기적", "황금나래", "은빛질주",
  "북두칠성", "푸른바람", "백두대간", "남해의별", "동방불패",
];
const SAMPLE_JOCKEYS = ["김기수", "이기수", "박기수", "최기수", "정기수"];
const SAMPLE_TRAINERS = ["김조교", "이조교", "박조교", "최조교", "정조교"];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// 결정론적 샘플 20건 생성 (같은 날짜 set이면 동일 source_unique_key → 중복 차단)
export type SampleAddResult =
  | { ok: true; inserted: number; skipped: number }
  | { ok: false; error: string };

export async function addSamplePublicData(): Promise<SampleAddResult> {
  const sid = getAppSessionId();
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  const rows: Array<{
    source: string;
    source_unique_key: string;
    race_date: string;
    venue: string;
    race_no: number;
    horse_no: number;
    horse_name: string;
    jockey: string;
    trainer: string;
    rank: number;
    win_odds: number;
    place_odds: number;
    weather: string;
    track_condition: string;
    raw_json: { mode: string; seed: number };
    app_session_id: string;
  }> = [];
  for (let i = 0; i < 20; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - (i % 10));
    const race_date = d.toISOString().slice(0, 10);
    const venue = SAMPLE_VENUES[i % SAMPLE_VENUES.length];
    const race_no = ((i * 3) % 11) + 1;
    const horse_no = (i % 8) + 1;
    const horseName = SAMPLE_HORSES[i % SAMPLE_HORSES.length];
    const jockey = SAMPLE_JOCKEYS[(i + 1) % SAMPLE_JOCKEYS.length];
    const trainer = SAMPLE_TRAINERS[(i + 2) % SAMPLE_TRAINERS.length];
    const rank = ((hash(horseName + jockey) % 8) + 1);
    const win_odds = +(2 + ((hash(horseName) % 200) / 10)).toFixed(2);
    const place_odds = +(1 + ((hash(jockey) % 60) / 10)).toFixed(2);
    rows.push({
      source: "sample",
      source_unique_key: `sample:${race_date}:${venue}:${race_no}:${horse_no}:${horseName}`,
      race_date,
      venue,
      race_no,
      horse_no,
      horse_name: horseName,
      jockey,
      trainer,
      rank,
      win_odds,
      place_odds,
      weather: "맑음",
      track_condition: "양호",
      raw_json: { mode: "client_sample", seed: i },
      app_session_id: sid,
    });
  }

  // 중복은 source_unique_key UNIQUE 제약이 막아주므로, 미리 존재 확인해 skip 카운트 산정
  const keys = rows.map((r) => r.source_unique_key as string);
  const { data: existing } = await supabase
    .from("public_race_results")
    .select("source_unique_key")
    .in("source_unique_key", keys);
  const have = new Set((existing ?? []).map((e) => e.source_unique_key as string));
  const toInsert = rows.filter((r) => !have.has(r.source_unique_key as string));
  const skipped = rows.length - toInsert.length;
  let inserted = 0;
  let errorMsg: string | null = null;
  if (toInsert.length) {
    const { error, data } = await supabase
      .from("public_race_results")
      .insert(toInsert)
      .select("id");
    if (error) errorMsg = error.message;
    else inserted = data?.length ?? toInsert.length;
  }

  await supabase.from("public_data_sync_logs").insert({
    status: errorMsg ? "error" : inserted > 0 ? "ok" : "all_skipped",
    inserted_count: inserted,
    skipped_count: skipped,
    error_message: errorMsg,
    sync_finished_at: new Date().toISOString(),
    app_session_id: sid,
  });

  if (errorMsg) return { ok: false, error: errorMsg };
  return { ok: true, inserted, skipped };
}

// 간이 모델: public_race_results에서 horse/jockey/trainer 별 입상률(rank<=3) 통계로 단승 점수 산출
export type ModelRefreshResult =
  | { ok: true; raceId: string; runId: string; rows: number; version: string }
  | { ok: false; error: string };

export async function refreshSimpleModel(
  preferredRaceId?: string,
): Promise<ModelRefreshResult> {
  const sid = getAppSessionId();

  // 1) 대상 race 선정: 인자 > horses가 있는 가장 최근 race
  let raceId = preferredRaceId ?? "";
  if (!raceId) {
    const { data: races } = await supabase
      .from("races")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    for (const r of races ?? []) {
      const { count } = await supabase
        .from("horses")
        .select("id", { count: "exact", head: true })
        .eq("race_id", r.id);
      if ((count ?? 0) > 0) {
        raceId = r.id;
        break;
      }
    }
  }
  if (!raceId) return { ok: false, error: "대상 경주가 없습니다. 먼저 경주를 만들고 출전마를 입력하세요." };

  const { data: horses } = await supabase
    .from("horses")
    .select("horse_no, horse_name, jockey, trainer")
    .eq("race_id", raceId);
  if (!horses?.length) return { ok: false, error: "출전마가 없습니다." };

  // 2) 통계 산정: 샘플 공공데이터에서 각 이름별 (입상횟수/전체횟수)
  const { data: pub } = await supabase
    .from("public_race_results")
    .select("horse_name, jockey, trainer, rank");
  const rateOf = (
    key: "horse_name" | "jockey" | "trainer",
    val: string | null | undefined,
  ): number => {
    if (!val) return 0;
    const filtered = (pub ?? []).filter((r) => r[key] === val);
    if (!filtered.length) return 0;
    const place = filtered.filter((r) => Number(r.rank) > 0 && Number(r.rank) <= 3).length;
    return place / filtered.length;
  };

  const scores = horses.map((h) => {
    const s =
      0.4 * rateOf("horse_name", h.horse_name) +
      0.3 * rateOf("jockey", h.jockey) +
      0.3 * rateOf("trainer", h.trainer);
    return { horse_no: Number(h.horse_no), score: s };
  });
  const sum = scores.reduce((a, b) => a + b.score, 0);
  const probs =
    sum > 0
      ? scores.map((s) => ({ horse_no: s.horse_no, probability: s.score / sum }))
      : scores.map((s) => ({ horse_no: s.horse_no, probability: 1 / scores.length }));

  // 3) model_run insert
  const version = `simple_v${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
  const { data: run, error: runErr } = await supabase
    .from("model_runs")
    .insert({
      race_id: raceId,
      model_name: "simple_stats_model",
      model_version: version,
      memo: `샘플 공공데이터(${pub?.length ?? 0}건) 기반 간이 통계 모델`,
      app_session_id: sid,
    })
    .select("id")
    .single();
  if (runErr || !run) return { ok: false, error: runErr?.message ?? "model_run 생성 실패" };

  // 4) model_probabilities insert (단승만)
  const bet_type: BetType = "단승";
  const probRows = probs.map((p) => ({
    model_run_id: run.id,
    race_id: raceId,
    bet_type,
    combination_key: combinationKey(bet_type, [p.horse_no]),
    horse_numbers: [p.horse_no],
    probability: p.probability,
    app_session_id: sid,
  }));
  const { error: pErr } = await supabase.from("model_probabilities").insert(probRows);
  if (pErr) {
    await supabase.from("model_update_logs").insert({
      model_run_id: run.id,
      model_name: "simple_stats_model",
      model_version: version,
      status: "error",
      trained_data_count: pub?.length ?? 0,
      generated_probability_count: 0,
      error_message: pErr.message,
      app_session_id: sid,
    });
    return { ok: false, error: pErr.message };
  }

  await supabase.from("model_update_logs").insert({
    model_run_id: run.id,
    model_name: "simple_stats_model",
    model_version: version,
    status: "ok",
    trained_data_count: pub?.length ?? 0,
    generated_probability_count: probRows.length,
    app_session_id: sid,
  });

  return { ok: true, raceId, runId: run.id, rows: probRows.length, version };
}

// EV 재계산: 특정(또는 최신) race의 최신 snapshot + 최신 model_run 기준으로 ev_results insert
export type EvRecalcResult =
  | { ok: true; raceId: string; rows: number }
  | { ok: false; error: string };

export async function recomputeEv(preferredRaceId?: string): Promise<EvRecalcResult> {
  const sid = getAppSessionId();

  // 1) race 선정
  let raceId = preferredRaceId ?? "";
  if (!raceId) {
    const { data: races } = await supabase
      .from("races")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    for (const r of races ?? []) {
      const { data: snap } = await supabase
        .from("odds_snapshots")
        .select("id")
        .eq("race_id", r.id)
        .limit(1);
      const { data: run } = await supabase
        .from("model_runs")
        .select("id")
        .eq("race_id", r.id)
        .limit(1);
      if (snap?.length && run?.length) {
        raceId = r.id;
        break;
      }
    }
  }
  if (!raceId) return { ok: false, error: "배당률 스냅샷 + 모델 런이 모두 있는 경주가 없습니다." };

  const { data: snap } = await supabase
    .from("odds_snapshots")
    .select("id")
    .eq("race_id", raceId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: run } = await supabase
    .from("model_runs")
    .select("id")
    .eq("race_id", raceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!snap || !run) return { ok: false, error: "스냅샷 또는 모델 런이 없습니다." };

  const [{ data: oe }, { data: pe }] = await Promise.all([
    supabase.from("odds_entries").select("*").eq("snapshot_id", snap.id),
    supabase.from("model_probabilities").select("*").eq("model_run_id", run.id),
  ]);
  const oddsMap = new Map<string, { odds: number }>();
  (oe ?? []).forEach((o) => oddsMap.set(`${o.bet_type}|${o.combination_key}`, { odds: Number(o.odds) }));

  type Row = {
    bet_type: string;
    combination_key: string;
    horse_numbers: number[];
    probability: number;
    odds: number;
    implied_probability: number;
    edge: number;
    ev: number;
    ev_percent: number;
    expected_return: number;
    recommendation: string;
  };
  const rows: Row[] = [];
  (pe ?? []).forEach((p) => {
    const o = oddsMap.get(`${p.bet_type}|${p.combination_key}`);
    if (!o) return;
    const c = calcEv(Number(p.probability), o.odds);
    rows.push({
      bet_type: p.bet_type,
      combination_key: p.combination_key,
      horse_numbers: p.horse_numbers,
      probability: Number(p.probability),
      odds: o.odds,
      ...c,
    });
  });
  rows.sort((a, b) => b.ev - a.ev || b.edge - a.edge || b.probability - a.probability);
  if (!rows.length) return { ok: false, error: "배당률/확률 매칭 결과가 0건입니다." };

  const insertRows = rows.map((r, i) => ({
    race_id: raceId,
    snapshot_id: snap.id,
    model_run_id: run.id,
    bet_type: r.bet_type,
    combination_key: r.combination_key,
    horse_numbers: r.horse_numbers,
    probability: r.probability,
    odds: r.odds,
    implied_probability: r.implied_probability,
    edge: r.edge,
    ev: r.ev,
    ev_percent: r.ev_percent,
    expected_return: r.expected_return,
    recommendation: r.recommendation,
    rank: i + 1,
    app_session_id: sid,
  }));
  const { error } = await supabase.from("ev_results").insert(insertRows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, raceId, rows: insertRows.length };
}

export type DataMgmtStats = {
  publicCount: number;
  lastSyncAt: string | null;
  lastModelUpdateAt: string | null;
  latestModelVersion: string | null;
};

export async function loadDataMgmtStats(): Promise<DataMgmtStats> {
  const [{ count }, { data: sync }, { data: mu }] = await Promise.all([
    supabase
      .from("public_race_results")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("public_data_sync_logs")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("model_update_logs")
      .select("created_at, model_version")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    publicCount: count ?? 0,
    lastSyncAt: sync?.created_at ?? null,
    lastModelUpdateAt: mu?.created_at ?? null,
    latestModelVersion: mu?.model_version ?? null,
  };
}

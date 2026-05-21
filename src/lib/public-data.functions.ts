// 공공데이터포털(한국마사회) 경주결과 동기화 + 간이 통계 모델 갱신.
// 본 스택은 Supabase Edge Function 대신 TanStack server function을 사용한다.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { combinationKey } from "./ev";

// =========================================================================
// 공통 — supabase admin client (RLS public, service_role 없어도 동작)
// =========================================================================
function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// =========================================================================
// 1) sync-kra-public-data
// =========================================================================
// 공공데이터포털 KRA 경주결과 OpenAPI. 응답 구조가 바뀔 수 있으므로 코드에서
// 쉽게 교체할 수 있게 상수로 분리한다.
const KRA_RACE_RESULT_URL =
  "https://apis.data.go.kr/B551015/API214_1/RaceDetailResult_1";
const KRA_MEETS: Array<{ code: string; name: string }> = [
  { code: "1", name: "서울" },
  { code: "2", name: "제주" },
  { code: "3", name: "부산경남" },
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
function isoDate(s: string): string {
  // "YYYYMMDD" -> "YYYY-MM-DD"
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s;
}
function safeNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function safeInt(v: unknown): number | null {
  const n = safeNum(v);
  return n == null ? null : Math.trunc(n);
}
function safeStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

// data.go.kr 응답에서 items 배열을 방어적으로 추출
function extractItems(json: unknown): Record<string, unknown>[] {
  if (!json || typeof json !== "object") return [];
  // response.body.items.item (array | object)
  const root = json as Record<string, unknown>;
  const resp = root.response as Record<string, unknown> | undefined;
  const body = resp?.body as Record<string, unknown> | undefined;
  const items = body?.items as Record<string, unknown> | undefined;
  const item = items?.item;
  if (!item) return [];
  return Array.isArray(item) ? (item as Record<string, unknown>[]) : [item as Record<string, unknown>];
}

// KRA item을 public_race_results row로 매핑 (필드명이 바뀌어도 안전)
function mapItemToRow(it: Record<string, unknown>, meetName: string) {
  const rcDate = safeStr(it.rcDate) ?? safeStr(it.rc_date) ?? "";
  const rcNo = safeInt(it.rcNo) ?? safeInt(it.rc_no);
  const horseNo = safeInt(it.chulNo) ?? safeInt(it.chul_no) ?? safeInt(it.hrNo);
  const horseName = safeStr(it.hrName) ?? safeStr(it.hr_name);
  const venue = safeStr(it.meet) ?? meetName;
  if (!rcDate || rcNo == null || horseNo == null || !horseName) return null;

  const uniqueKey = `${rcDate}-${venue}-${rcNo}-${horseNo}`;
  return {
    source_unique_key: uniqueKey,
    race_date: isoDate(rcDate),
    venue,
    race_no: rcNo,
    race_name: safeStr(it.rcName) ?? safeStr(it.rc_name),
    distance_m: safeInt(it.rcDist) ?? safeInt(it.rc_dist),
    horse_no: horseNo,
    horse_name: horseName,
    jockey: safeStr(it.jkName) ?? safeStr(it.jk_name),
    trainer: safeStr(it.trName) ?? safeStr(it.tr_name),
    owner_name: safeStr(it.owName) ?? safeStr(it.ow_name),
    rating: safeNum(it.rating),
    horse_weight: safeNum(it.wgHr) ?? safeNum(it.wg_hr),
    carried_weight: safeNum(it.wgBudam) ?? safeNum(it.wg_budam),
    sex_age: safeStr(it.sex) ?? safeStr(it.age),
    rank: safeInt(it.ord) ?? safeInt(it.rank),
    race_record: safeStr(it.rcTime) ?? safeStr(it.rc_time),
    margin: safeStr(it.diffUnit) ?? safeStr(it.diff_unit),
    win_odds: safeNum(it.winOdds) ?? safeNum(it.win_odds),
    place_odds: safeNum(it.plcOdds) ?? safeNum(it.plc_odds),
    quinella_odds: safeNum(it.quOdds) ?? safeNum(it.qu_odds),
    weather: safeStr(it.weather),
    track_condition: safeStr(it.track) ?? safeStr(it.trackCondition),
    raw_json: it,
    updated_at: new Date().toISOString(),
  };
}

const SyncInput = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const syncKraPublicData = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SyncInput.parse(data))
  .handler(async ({ data }) => {
    const supabaseMaybe = getSupabase();
    if (!supabaseMaybe) return { ok: false as const, error: "DB 설정이 누락되었습니다." };
    const supabase = supabaseMaybe;


    const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
    // 로그 생성
    const { data: logRow } = await supabase
      .from("public_data_sync_logs")
      .insert({
        status: "running",
        target_date_from: data.dateFrom,
        target_date_to: data.dateTo,
      })
      .select("id")
      .single();
    const logId = logRow?.id as string | undefined;

    async function finalize(patch: Record<string, unknown>) {
      if (!logId) return;
      await supabase
        .from("public_data_sync_logs")
        .update({ ...patch, sync_finished_at: new Date().toISOString() })
        .eq("id", logId);
    }

    if (!serviceKey) {
      const msg = "DATA_GO_KR_SERVICE_KEY가 Lovable Cloud Secrets에 설정되어 있지 않습니다";
      await finalize({ status: "error", error_message: msg });
      return { ok: false as const, error: msg };
    }

    const from = new Date(data.dateFrom);
    const to = new Date(data.dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      const msg = "날짜 범위가 올바르지 않습니다.";
      await finalize({ status: "error", error_message: msg });
      return { ok: false as const, error: msg };
    }

    let fetched = 0;
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    // 일자 × 경마장 루프 (방어적: 어떤 호출이 실패해도 전체는 진행)
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dayStr = ymd(d);
      for (const meet of KRA_MEETS) {
        try {
          const url = new URL(KRA_RACE_RESULT_URL);
          url.searchParams.set("serviceKey", serviceKey);
          url.searchParams.set("meet", meet.code);
          url.searchParams.set("rc_date", dayStr);
          url.searchParams.set("_type", "json");
          url.searchParams.set("pageNo", "1");
          url.searchParams.set("numOfRows", "500");

          const res = await fetch(url.toString(), { method: "GET" });
          if (!res.ok) {
            errors.push(`${dayStr}/${meet.name} HTTP ${res.status}`);
            continue;
          }
          const text = await res.text();
          let json: unknown;
          try {
            json = JSON.parse(text);
          } catch {
            // 일부 응답은 XML 에러 메시지일 수 있음 — 무시하고 다음 일자
            continue;
          }
          const items = extractItems(json);
          fetched += items.length;
          const rows = items
            .map((it) => mapItemToRow(it, meet.name))
            .filter((r): r is NonNullable<typeof r> => r !== null);
          if (!rows.length) continue;

          // upsert by source_unique_key
          const { data: upserted, error } = await supabase
            .from("public_race_results")
            .upsert(rows, { onConflict: "source_unique_key", ignoreDuplicates: false })
            .select("id");
          if (error) {
            errors.push(`${dayStr}/${meet.name} DB: ${error.message}`);
            continue;
          }
          const got = upserted?.length ?? 0;
          inserted += got;
          skipped += rows.length - got;
        } catch (e) {
          errors.push(`${dayStr}/${meet.name} ${(e as Error).message}`);
        }
      }
    }

    const status = errors.length && inserted === 0 ? "error" : "success";
    await finalize({
      status,
      fetched_count: fetched,
      inserted_count: inserted,
      skipped_count: skipped,
      error_message: errors.length ? errors.slice(0, 5).join(" | ") : null,
    });

    return {
      ok: status === "success",
      fetched,
      inserted,
      skipped,
      errorSamples: errors.slice(0, 3),
    };
  });

// =========================================================================
// 2) update-simple-model
// =========================================================================
const ModelInput = z.object({
  raceId: z.string().uuid(),
});

type StatAgg = { runs: number; wins: number; places: number; ranks: number };
function emptyAgg(): StatAgg {
  return { runs: 0, wins: 0, places: 0, ranks: 0 };
}

export const updateSimpleModel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ModelInput.parse(data))
  .handler(async ({ data }) => {
    const supabaseMaybe = getSupabase();
    if (!supabaseMaybe) return { ok: false as const, error: "DB 설정이 누락되었습니다." };
    const supabase = supabaseMaybe;


    // 대상 경주의 출전마 로드
    const { data: horses, error: hErr } = await supabase
      .from("horses")
      .select("horse_no,horse_name,jockey,trainer")
      .eq("race_id", data.raceId);
    if (hErr) return { ok: false as const, error: `출전마 조회 실패: ${hErr.message}` };
    if (!horses || horses.length < 2) {
      return { ok: false as const, error: "출전마가 2두 이상이어야 합니다." };
    }

    // 관련 이름들에 대해 공공데이터 통계 한 번에 조회
    const horseNames = [...new Set(horses.map((h) => h.horse_name).filter(Boolean))] as string[];
    const jockeyNames = [...new Set(horses.map((h) => h.jockey).filter(Boolean))] as string[];
    const trainerNames = [...new Set(horses.map((h) => h.trainer).filter(Boolean))] as string[];

    async function loadStats(col: "horse_name" | "jockey" | "trainer", names: string[]) {
      const m = new Map<string, StatAgg>();
      if (!names.length) return m;
      const { data: rows } = await supabase
        .from("public_race_results")
        .select(`${col},rank`)
        .in(col, names);
      for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
        const key = String(r[col] ?? "");
        if (!key) continue;
        const rk = typeof r.rank === "number" ? r.rank : Number(r.rank);
        const agg = m.get(key) ?? emptyAgg();
        agg.runs += 1;
        if (Number.isFinite(rk)) {
          agg.ranks += rk;
          if (rk === 1) agg.wins += 1;
          if (rk >= 1 && rk <= 3) agg.places += 1;
        }
        m.set(key, agg);
      }
      return m;
    }

    const trainedCount = await (async () => {
      const { count } = await supabase
        .from("public_race_results")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    })();

    const [horseStats, jockeyStats, trainerStats] = await Promise.all([
      loadStats("horse_name", horseNames),
      loadStats("jockey", jockeyNames),
      loadStats("trainer", trainerNames),
    ]);

    const PRIOR_PLACE = 0.25; // 데이터 부족 시 기본값
    const PRIOR_WIN = 0.1;
    function placeRate(s: StatAgg | undefined): number {
      if (!s || s.runs < 3) return PRIOR_PLACE;
      return s.places / s.runs;
    }
    function recentActivity(s: StatAgg | undefined): number {
      if (!s) return 0;
      // 0~1 정규화: runs 20회 이상이면 1.0
      return Math.min(1, s.runs / 20);
    }

    // 모델 런 생성
    const { data: runRow, error: runErr } = await supabase
      .from("model_runs")
      .insert({
        race_id: data.raceId,
        model_name: "simple_stats_model",
        model_version: "v1",
        memo: "공공데이터 기반 간이 통계 모델",
        params: {
          weights: { horse_place: 0.4, jockey_place: 0.25, trainer_place: 0.25, recent: 0.1 },
          trained_data_count: trainedCount,
        },
      })
      .select("id")
      .single();
    if (runErr || !runRow) {
      return { ok: false as const, error: `모델 런 생성 실패: ${runErr?.message ?? "unknown"}` };
    }
    const modelRunId = runRow.id as string;

    // 점수 → 정규화 → 단승 확률
    const scores = horses.map((h) => {
      const hp = placeRate(horseStats.get(String(h.horse_name)));
      const jp = placeRate(jockeyStats.get(String(h.jockey ?? "")));
      const tp = placeRate(trainerStats.get(String(h.trainer ?? "")));
      const ra =
        (recentActivity(horseStats.get(String(h.horse_name))) +
          recentActivity(jockeyStats.get(String(h.jockey ?? "")))) /
        2;
      const score = 0.4 * hp + 0.25 * jp + 0.25 * tp + 0.1 * ra;
      // 데이터가 전혀 없을 때 모든 score가 비슷해지면 균등분포가 됨 (안전)
      return { horse_no: h.horse_no as number, score: Math.max(score, PRIOR_WIN) };
    });
    const sum = scores.reduce((s, x) => s + x.score, 0) || 1;

    const probRows = scores.map((s) => ({
      race_id: data.raceId,
      model_run_id: modelRunId,
      bet_type: "단승",
      combination_key: combinationKey("단승", [s.horse_no]),
      horse_numbers: [s.horse_no],
      probability: s.score / sum,
    }));

    const { error: pErr } = await supabase.from("model_probabilities").insert(probRows);
    if (pErr) {
      await supabase.from("model_update_logs").insert({
        model_run_id: modelRunId,
        model_name: "simple_stats_model",
        model_version: "v1",
        status: "error",
        trained_data_count: trainedCount,
        generated_probability_count: 0,
        error_message: pErr.message,
      });
      return { ok: false as const, error: `확률 저장 실패: ${pErr.message}` };
    }

    await supabase.from("model_update_logs").insert({
      model_run_id: modelRunId,
      model_name: "simple_stats_model",
      model_version: "v1",
      status: "success",
      trained_data_count: trainedCount,
      generated_probability_count: probRows.length,
    });

    return {
      ok: true as const,
      modelRunId,
      trainedCount,
      generated: probRows.length,
    };
  });

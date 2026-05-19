import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Trash2,
  Plus,
  Upload,
  Download,
  Save,
  ImageIcon,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  BET_TYPES,
  type BetType,
  calcEv,
  combinationKey,
  fmtEvPct,
  fmtOdds,
  fmtPct,
  parseHorseNumbers,
  recommendationVariant,
} from "@/lib/ev";

const tabSchema = z.object({
  tab: z.enum(["horses", "odds", "probs", "ev"]).default("horses"),
});

export const Route = createFileRoute("/races/$raceId")({
  validateSearch: tabSchema,
  component: RaceDetail,
  head: () => ({
    meta: [
      { title: "경주 상세 — 경마 EV 계산기" },
      { name: "description", content: "출전마, 배당률, 모델 확률 입력 및 EV 결과 확인" },
    ],
  }),
});

type Race = {
  id: string;
  race_date: string;
  venue: string;
  race_no: number;
  distance_m: number | null;
  track_condition: string | null;
  weather: string | null;
  memo: string | null;
};
type Horse = {
  id: string;
  race_id: string;
  horse_no: number;
  horse_name: string;
  jockey: string | null;
  trainer: string | null;
  carried_weight: number | null;
  sex_age: string | null;
  memo: string | null;
};
type OddsSnapshot = {
  id: string;
  race_id: string;
  source: string | null;
  screenshot_url: string | null;
  captured_at: string;
  memo: string | null;
};
type OddsEntry = {
  id: string;
  snapshot_id: string;
  race_id: string;
  bet_type: string;
  combination_key: string;
  horse_numbers: number[];
  odds: number;
  ocr_confidence: number | null;
  is_manual_edited: boolean;
};
type ModelRun = { id: string; race_id: string; model_name: string | null; created_at: string };
type ModelProb = {
  id: string;
  model_run_id: string;
  race_id: string;
  bet_type: string;
  combination_key: string;
  horse_numbers: number[];
  probability: number;
  memo: string | null;
};

function RaceDetail() {
  const { raceId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  const [race, setRace] = useState<Race | null>(null);
  const [horses, setHorses] = useState<Horse[]>([]);

  const loadRace = useCallback(async () => {
    const { data } = await supabase.from("races").select("*").eq("id", raceId).single();
    setRace((data as Race) ?? null);
    const { data: h } = await supabase
      .from("horses")
      .select("*")
      .eq("race_id", raceId)
      .order("horse_no");
    setHorses((h as Horse[]) ?? []);
  }, [raceId]);

  useEffect(() => {
    void loadRace();
  }, [loadRace]);

  if (!race) {
    return <div className="py-12 text-center text-muted-foreground">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> 홈으로
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {race.venue} · {race.race_no}R
          </h1>
          <p className="text-sm text-muted-foreground">
            {race.race_date} · {race.distance_m ?? "-"}m · 주로 {race.track_condition ?? "-"} ·{" "}
            {race.weather ?? "-"}
          </p>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) =>
          navigate({
            to: "/races/$raceId",
            params: { raceId },
            search: { tab: v as "horses" | "odds" | "probs" | "ev" },
            replace: true,
          })
        }
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="horses">출전마</TabsTrigger>
          <TabsTrigger value="odds">배당률</TabsTrigger>
          <TabsTrigger value="probs">모델 확률</TabsTrigger>
          <TabsTrigger value="ev">EV 결과</TabsTrigger>
        </TabsList>

        <TabsContent value="horses" className="mt-4">
          <HorsesTab raceId={raceId} horses={horses} onChanged={loadRace} />
        </TabsContent>
        <TabsContent value="odds" className="mt-4">
          <OddsTab raceId={raceId} horses={horses} />
        </TabsContent>
        <TabsContent value="probs" className="mt-4">
          <ProbsTab raceId={raceId} />
        </TabsContent>
        <TabsContent value="ev" className="mt-4">
          <EvTab raceId={raceId} horses={horses} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- HORSES ---------------- */
function HorsesTab({
  raceId,
  horses,
  onChanged,
}: {
  raceId: string;
  horses: Horse[];
  onChanged: () => void;
}) {
  const [newHorse, setNewHorse] = useState({
    horse_no: horses.length + 1,
    horse_name: "",
    jockey: "",
    trainer: "",
    carried_weight: 56,
    sex_age: "",
  });

  useEffect(() => {
    setNewHorse((p) => ({ ...p, horse_no: horses.length + 1 }));
  }, [horses.length]);

  const add = async () => {
    if (!newHorse.horse_name.trim()) {
      toast.error("마명을 입력하세요");
      return;
    }
    const { error } = await supabase.from("horses").insert({ race_id: raceId, ...newHorse });
    if (error) toast.error("추가 실패");
    else {
      setNewHorse({
        horse_no: horses.length + 2,
        horse_name: "",
        jockey: "",
        trainer: "",
        carried_weight: 56,
        sex_age: "",
      });
      onChanged();
    }
  };
  const remove = async (id: string) => {
    await supabase.from("horses").delete().eq("id", id);
    onChanged();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">출전마</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">마번</th>
                <th className="px-3 py-2 text-left">마명</th>
                <th className="px-3 py-2 text-left">기수</th>
                <th className="px-3 py-2 text-left">조교사</th>
                <th className="px-3 py-2 text-left">부담중량</th>
                <th className="px-3 py-2 text-left">성별/연령</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {horses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    출전마가 없습니다.
                  </td>
                </tr>
              )}
              {horses.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="px-3 py-2 num font-medium">{h.horse_no}</td>
                  <td className="px-3 py-2">{h.horse_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{h.jockey ?? "-"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{h.trainer ?? "-"}</td>
                  <td className="px-3 py-2 num">{h.carried_weight ?? "-"}</td>
                  <td className="px-3 py-2">{h.sex_age ?? "-"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => remove(h.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-sm font-medium">출전마 추가</div>
          <div className="grid gap-2 sm:grid-cols-6">
            <Input
              type="number"
              placeholder="마번"
              value={newHorse.horse_no}
              onChange={(e) => setNewHorse({ ...newHorse, horse_no: +e.target.value })}
            />
            <Input
              placeholder="마명"
              className="sm:col-span-2"
              value={newHorse.horse_name}
              onChange={(e) => setNewHorse({ ...newHorse, horse_name: e.target.value })}
            />
            <Input
              placeholder="기수"
              value={newHorse.jockey}
              onChange={(e) => setNewHorse({ ...newHorse, jockey: e.target.value })}
            />
            <Input
              placeholder="조교사"
              value={newHorse.trainer}
              onChange={(e) => setNewHorse({ ...newHorse, trainer: e.target.value })}
            />
            <Input
              placeholder="성별/연령"
              value={newHorse.sex_age}
              onChange={(e) => setNewHorse({ ...newHorse, sex_age: e.target.value })}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={add}>
              <Plus className="h-4 w-4" /> 추가
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- ODDS ---------------- */
function OddsTab({ raceId, horses }: { raceId: string; horses: Horse[] }) {
  const [snapshots, setSnapshots] = useState<OddsSnapshot[]>([]);
  const [activeSnap, setActiveSnap] = useState<OddsSnapshot | null>(null);
  const [entries, setEntries] = useState<OddsEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [newRow, setNewRow] = useState({
    bet_type: "단승" as BetType,
    horse_numbers: "1",
    odds: "",
  });

  const reload = useCallback(async () => {
    const { data: snaps } = await supabase
      .from("odds_snapshots")
      .select("*")
      .eq("race_id", raceId)
      .order("captured_at", { ascending: false });
    const list = (snaps as OddsSnapshot[]) ?? [];
    setSnapshots(list);
    if (list.length && !activeSnap) setActiveSnap(list[0]);
  }, [raceId, activeSnap]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!activeSnap) {
      setEntries([]);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("odds_entries")
        .select("*")
        .eq("snapshot_id", activeSnap.id)
        .order("bet_type")
        .order("combination_key");
      setEntries((data as OddsEntry[]) ?? []);
    })();
  }, [activeSnap]);

  const createSnapshot = async (screenshot_url?: string | null) => {
    const { data, error } = await supabase
      .from("odds_snapshots")
      .insert({ race_id: raceId, screenshot_url: screenshot_url ?? null, source: "manual" })
      .select("*")
      .single();
    if (error) {
      toast.error("스냅샷 생성 실패");
      return null;
    }
    setActiveSnap(data as OddsSnapshot);
    await reload();
    return data as OddsSnapshot;
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `${raceId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("odds-screenshots").upload(path, file);
      if (error) throw error;
      const { data: pub } = supabase.storage.from("odds-screenshots").getPublicUrl(path);
      await createSnapshot(pub.publicUrl);
      toast.success("이미지 업로드 완료 (자동 추출 준비 중 — 수동 입력 가능)");
    } catch (e) {
      console.error(e);
      toast.error("업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const addEntry = async () => {
    if (!activeSnap) {
      const snap = await createSnapshot();
      if (!snap) return;
    }
    const snap = activeSnap ?? (await createSnapshot());
    if (!snap) return;
    const nums = parseHorseNumbers(newRow.horse_numbers);
    const oddsNum = parseFloat(newRow.odds);
    if (!nums.length || !Number.isFinite(oddsNum) || oddsNum <= 0) {
      toast.error("마번/배당률을 확인하세요");
      return;
    }
    const { error } = await supabase.from("odds_entries").insert({
      snapshot_id: snap.id,
      race_id: raceId,
      bet_type: newRow.bet_type,
      combination_key: combinationKey(newRow.bet_type, nums),
      horse_numbers: nums,
      odds: oddsNum,
      is_manual_edited: true,
    });
    if (error) toast.error("추가 실패");
    else {
      setNewRow({ ...newRow, horse_numbers: "", odds: "" });
      const { data } = await supabase
        .from("odds_entries")
        .select("*")
        .eq("snapshot_id", snap.id);
      setEntries((data as OddsEntry[]) ?? []);
    }
  };

  const updateOdds = async (id: string, odds: number) => {
    await supabase
      .from("odds_entries")
      .update({ odds, is_manual_edited: true })
      .eq("id", id);
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, odds, is_manual_edited: true } : e)));
  };
  const removeEntry = async (id: string) => {
    await supabase.from("odds_entries").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };
  const removeSnapshot = async (id: string) => {
    if (!confirm("이 배당률 스냅샷과 모든 항목을 삭제하시겠습니까?")) return;
    await supabase.from("odds_entries").delete().eq("snapshot_id", id);
    const { error } = await supabase.from("odds_snapshots").delete().eq("id", id);
    if (error) {
      toast.error("삭제 실패");
      return;
    }
    toast.success("스냅샷 삭제됨");
    if (activeSnap?.id === id) setActiveSnap(null);
    await reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">더비온 캡처 업로드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                }}
              />
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                <Upload className="h-4 w-4" /> {uploading ? "업로드 중..." : "캡처 이미지 업로드"}
              </span>
            </label>
            <Button variant="secondary" size="sm" disabled>
              자동 추출 (준비 중)
            </Button>
            <Button variant="outline" size="sm" onClick={() => createSnapshot()}>
              <Plus className="h-4 w-4" /> 빈 스냅샷 만들기
            </Button>
          </div>
          {activeSnap?.screenshot_url && (
            <div className="rounded-md border p-2">
              <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <ImageIcon className="h-3 w-3" /> 미리보기
              </div>
              <img
                src={activeSnap.screenshot_url}
                alt="배당률 캡처"
                className="max-h-72 rounded"
              />
            </div>
          )}
          {snapshots.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">스냅샷:</span>
              {snapshots.map((s) => (
                <div
                  key={s.id}
                  className={`inline-flex items-center gap-1 rounded-md border ${
                    activeSnap?.id === s.id ? "border-primary bg-primary/10" : ""
                  }`}
                >
                  <button
                    onClick={() => setActiveSnap(s)}
                    className="px-2 py-1 hover:bg-accent rounded-l-md"
                  >
                    {new Date(s.captured_at).toLocaleString("ko-KR")}
                  </button>
                  <button
                    onClick={() => void removeSnapshot(s.id)}
                    className="px-1.5 py-1 text-muted-foreground hover:text-destructive"
                    aria-label="스냅샷 삭제"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">배당률 표</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">승식</th>
                  <th className="px-3 py-2 text-left">조합</th>
                  <th className="px-3 py-2 text-left">마번 목록</th>
                  <th className="px-3 py-2 text-right">배당률</th>
                  <th className="px-3 py-2 text-right">OCR 신뢰도</th>
                  <th className="px-3 py-2 text-center">수동 수정</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      배당률 항목이 없습니다. 아래에서 추가하세요.
                    </td>
                  </tr>
                )}
                {entries.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{e.bet_type}</Badge>
                    </td>
                    <td className="px-3 py-2 num">{e.combination_key}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.horse_numbers.join(", ")}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 w-24 text-right num"
                        defaultValue={e.odds}
                        onBlur={(ev) => {
                          const n = parseFloat(ev.target.value);
                          if (Number.isFinite(n) && n > 0 && n !== e.odds) void updateOdds(e.id, n);
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right num text-muted-foreground">
                      {e.ocr_confidence != null ? fmtPct(e.ocr_confidence, 0) : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {e.is_manual_edited ? (
                        <Badge>수동</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => removeEntry(e.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">배당률 항목 추가</div>
            <div className="grid gap-2 sm:grid-cols-5">
              <Select
                value={newRow.bet_type}
                onValueChange={(v) => setNewRow({ ...newRow, bet_type: v as BetType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BET_TYPES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder='마번 (예: "1" 또는 "1,3")'
                className="sm:col-span-2"
                value={newRow.horse_numbers}
                onChange={(e) => setNewRow({ ...newRow, horse_numbers: e.target.value })}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="배당률"
                value={newRow.odds}
                onChange={(e) => setNewRow({ ...newRow, odds: e.target.value })}
              />
              <Button onClick={addEntry}>
                <Plus className="h-4 w-4" /> 추가
              </Button>
            </div>
            {horses.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                현재 출전마 마번: {horses.map((h) => h.horse_no).join(", ")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- PROBS ---------------- */
function ProbsTab({ raceId }: { raceId: string }) {
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [activeRun, setActiveRun] = useState<ModelRun | null>(null);
  const [probs, setProbs] = useState<ModelProb[]>([]);
  const [newRow, setNewRow] = useState({
    bet_type: "단승" as BetType,
    horse_numbers: "",
    probability: "",
  });
  const [csv, setCsv] = useState("");

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("model_runs")
      .select("*")
      .eq("race_id", raceId)
      .order("created_at", { ascending: false });
    const list = (data as ModelRun[]) ?? [];
    setRuns(list);
    if (list.length && !activeRun) setActiveRun(list[0]);
  }, [raceId, activeRun]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!activeRun) {
      setProbs([]);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("model_probabilities")
        .select("*")
        .eq("model_run_id", activeRun.id)
        .order("bet_type")
        .order("combination_key");
      setProbs((data as ModelProb[]) ?? []);
    })();
  }, [activeRun]);

  const ensureRun = async (): Promise<ModelRun | null> => {
    if (activeRun) return activeRun;
    const { data, error } = await supabase
      .from("model_runs")
      .insert({ race_id: raceId, model_name: "manual" })
      .select("*")
      .single();
    if (error) {
      toast.error("모델 런 생성 실패");
      return null;
    }
    setActiveRun(data as ModelRun);
    void reload();
    return data as ModelRun;
  };

  const newRun = async () => {
    const { data } = await supabase
      .from("model_runs")
      .insert({ race_id: raceId, model_name: "manual" })
      .select("*")
      .single();
    if (data) {
      setActiveRun(data as ModelRun);
      void reload();
    }
  };

  const add = async () => {
    const run = await ensureRun();
    if (!run) return;
    const nums = parseHorseNumbers(newRow.horse_numbers);
    const p = parseFloat(newRow.probability);
    if (!nums.length || !Number.isFinite(p) || p <= 0 || p > 1) {
      toast.error("마번/확률(0~1)을 확인하세요");
      return;
    }
    const { error } = await supabase.from("model_probabilities").insert({
      model_run_id: run.id,
      race_id: raceId,
      bet_type: newRow.bet_type,
      combination_key: combinationKey(newRow.bet_type, nums),
      horse_numbers: nums,
      probability: p,
    });
    if (error) toast.error("추가 실패");
    else {
      setNewRow({ ...newRow, horse_numbers: "", probability: "" });
      const { data } = await supabase
        .from("model_probabilities")
        .select("*")
        .eq("model_run_id", run.id);
      setProbs((data as ModelProb[]) ?? []);
    }
  };

  const importCsv = async () => {
    const run = await ensureRun();
    if (!run) return;
    const lines = csv.trim().split(/\r?\n/);
    if (!lines.length) return;
    const start = /bet_type/i.test(lines[0]) ? 1 : 0;
    const rows = [];
    for (let i = start; i < lines.length; i++) {
      // bet_type,combination,horse_numbers,probability
      // horse_numbers may contain commas, so support quoted "1,3"
      const m = lines[i].match(/^([^,]+),([^,]+),(?:"([^"]+)"|([^,]+)),([\d.]+)$/);
      if (!m) continue;
      const bet_type = m[1].trim() as BetType;
      const horse_numbers = parseHorseNumbers(m[3] ?? m[4] ?? "");
      const probability = parseFloat(m[5]);
      if (!horse_numbers.length || !Number.isFinite(probability)) continue;
      rows.push({
        model_run_id: run.id,
        race_id: raceId,
        bet_type,
        combination_key: combinationKey(bet_type, horse_numbers),
        horse_numbers,
        probability,
      });
    }
    if (!rows.length) {
      toast.error("파싱된 행이 없습니다");
      return;
    }
    const { error } = await supabase.from("model_probabilities").insert(rows);
    if (error) toast.error("CSV 저장 실패");
    else {
      toast.success(`${rows.length}건 저장`);
      setCsv("");
      const { data } = await supabase
        .from("model_probabilities")
        .select("*")
        .eq("model_run_id", run.id);
      setProbs((data as ModelProb[]) ?? []);
    }
  };

  const updateProb = async (id: string, p: number) => {
    await supabase.from("model_probabilities").update({ probability: p }).eq("id", id);
    setProbs((prev) => prev.map((x) => (x.id === id ? { ...x, probability: p } : x)));
  };
  const remove = async (id: string) => {
    await supabase.from("model_probabilities").delete().eq("id", id);
    setProbs((prev) => prev.filter((x) => x.id !== id));
  };
  const removeRun = async (id: string) => {
    if (!confirm("이 모델 런과 모든 확률을 삭제하시겠습니까?")) return;
    await supabase.from("model_probabilities").delete().eq("model_run_id", id);
    const { error } = await supabase.from("model_runs").delete().eq("id", id);
    if (error) {
      toast.error("삭제 실패");
      return;
    }
    toast.success("모델 런 삭제됨");
    if (activeRun?.id === id) setActiveRun(null);
    await reload();
  };

  // 합계 검증
  const sums = useMemo(() => {
    const map: Record<string, number> = {};
    probs.forEach((p) => {
      map[p.bet_type] = (map[p.bet_type] ?? 0) + Number(p.probability);
    });
    return map;
  }, [probs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">모델 런</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={newRun}>
              <Plus className="h-4 w-4" /> 새 모델 런
            </Button>
            {runs.map((r) => (
              <div
                key={r.id}
                className={`inline-flex items-center gap-1 rounded-md border text-xs ${
                  activeRun?.id === r.id ? "border-primary bg-primary/10" : ""
                }`}
              >
                <button
                  onClick={() => setActiveRun(r)}
                  className="px-2 py-1 hover:bg-accent rounded-l-md"
                >
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </button>
                <button
                  onClick={() => void removeRun(r.id)}
                  className="px-1.5 py-1 text-muted-foreground hover:text-destructive"
                  aria-label="모델 런 삭제"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          {Object.keys(sums).length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(sums).map(([k, v]) => {
                const ok = k === "단승" ? Math.abs(v - 1) < 0.02 : true;
                return (
                  <Badge key={k} variant={ok ? "secondary" : "destructive"}>
                    {k} 합계 {fmtPct(v)}
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">모델 확률</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">승식</th>
                  <th className="px-3 py-2 text-left">조합</th>
                  <th className="px-3 py-2 text-left">마번 목록</th>
                  <th className="px-3 py-2 text-right">모델 확률</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {probs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      모델 확률이 없습니다.
                    </td>
                  </tr>
                )}
                {probs.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{p.bet_type}</Badge>
                    </td>
                    <td className="px-3 py-2 num">{p.combination_key}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.horse_numbers.join(", ")}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        step="0.001"
                        className="h-8 w-24 text-right num"
                        defaultValue={p.probability}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v) && v > 0 && v !== Number(p.probability))
                            void updateProb(p.id, v);
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">확률 항목 추가</div>
            <div className="grid gap-2 sm:grid-cols-5">
              <Select
                value={newRow.bet_type}
                onValueChange={(v) => setNewRow({ ...newRow, bet_type: v as BetType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BET_TYPES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder='마번 (예: "1" 또는 "1,3")'
                className="sm:col-span-2"
                value={newRow.horse_numbers}
                onChange={(e) => setNewRow({ ...newRow, horse_numbers: e.target.value })}
              />
              <Input
                type="number"
                step="0.001"
                placeholder="확률 (0~1)"
                value={newRow.probability}
                onChange={(e) => setNewRow({ ...newRow, probability: e.target.value })}
              />
              <Button onClick={add}>
                <Plus className="h-4 w-4" /> 추가
              </Button>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm font-medium">CSV 붙여넣기</Label>
              <Button size="sm" variant="secondary" onClick={importCsv}>
                <Upload className="h-4 w-4" /> 가져오기
              </Button>
            </div>
            <Textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={`bet_type,combination,horse_numbers,probability\n단승,1,1,0.18\n복승,1-3,"1,3",0.08`}
              rows={5}
              className="font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- EV ---------------- */
type EvRow = {
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

function EvTab({ raceId, horses }: { raceId: string; horses: Horse[] }) {
  const [snap, setSnap] = useState<OddsSnapshot | null>(null);
  const [run, setRun] = useState<ModelRun | null>(null);
  const [oddsList, setOddsList] = useState<OddsEntry[]>([]);
  const [probsList, setProbsList] = useState<ModelProb[]>([]);
  const [filterType, setFilterType] = useState<"전체" | BetType>("전체");
  const [onlyPositive, setOnlyPositive] = useState(false);
  const [minProb, setMinProb] = useState("");
  const [minOdds, setMinOdds] = useState("");

  const horseNameMap = useMemo(() => {
    const m: Record<number, string> = {};
    horses.forEach((h) => (m[h.horse_no] = h.horse_name));
    return m;
  }, [horses]);

  useEffect(() => {
    void (async () => {
      const { data: s } = await supabase
        .from("odds_snapshots")
        .select("*")
        .eq("race_id", raceId)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSnap((s as OddsSnapshot) ?? null);

      const { data: r } = await supabase
        .from("model_runs")
        .select("*")
        .eq("race_id", raceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setRun((r as ModelRun) ?? null);

      if (s) {
        const { data: oe } = await supabase
          .from("odds_entries")
          .select("*")
          .eq("snapshot_id", (s as OddsSnapshot).id);
        setOddsList((oe as OddsEntry[]) ?? []);
      } else setOddsList([]);

      if (r) {
        const { data: pe } = await supabase
          .from("model_probabilities")
          .select("*")
          .eq("model_run_id", (r as ModelRun).id);
        setProbsList((pe as ModelProb[]) ?? []);
      } else setProbsList([]);
    })();
  }, [raceId]);

  const evRows = useMemo<EvRow[]>(() => {
    const oddsMap = new Map<string, OddsEntry>();
    oddsList.forEach((o) => oddsMap.set(`${o.bet_type}|${o.combination_key}`, o));

    const rows: EvRow[] = [];
    probsList.forEach((p) => {
      const key = `${p.bet_type}|${p.combination_key}`;
      const o = oddsMap.get(key);
      if (!o) return;
      const c = calcEv(Number(p.probability), Number(o.odds));
      rows.push({
        bet_type: p.bet_type,
        combination_key: p.combination_key,
        horse_numbers: p.horse_numbers,
        probability: Number(p.probability),
        odds: Number(o.odds),
        ...c,
      });
    });
    rows.sort(
      (a, b) =>
        b.ev - a.ev ||
        b.edge - a.edge ||
        b.probability - a.probability,
    );
    return rows;
  }, [oddsList, probsList]);

  const filtered = useMemo(() => {
    const minP = parseFloat(minProb);
    const minO = parseFloat(minOdds);
    return evRows.filter((r) => {
      if (filterType !== "전체" && r.bet_type !== filterType) return false;
      if (onlyPositive && r.ev <= 0) return false;
      if (Number.isFinite(minP) && r.probability < minP) return false;
      if (Number.isFinite(minO) && r.odds < minO) return false;
      return true;
    });
  }, [evRows, filterType, onlyPositive, minProb, minOdds]);

  const summary = useMemo(() => {
    const positive = evRows.filter((r) => r.ev > 0);
    return {
      total: evRows.length,
      positive: positive.length,
      maxEv: evRows.length ? Math.max(...evRows.map((r) => r.ev)) : 0,
      maxEdge: evRows.length ? Math.max(...evRows.map((r) => r.edge)) : 0,
    };
  }, [evRows]);

  const saveResults = async () => {
    if (!snap || !run) {
      toast.error("스냅샷 또는 모델 런이 없습니다");
      return;
    }
    if (!evRows.length) {
      toast.error("계산할 결과가 없습니다");
      return;
    }
    const rows = evRows.map((r, i) => ({
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
    }));
    const { error } = await supabase.from("ev_results").insert(rows);
    if (error) toast.error("저장 실패");
    else toast.success(`EV 결과 ${rows.length}건 저장`);
  };

  const downloadCsv = () => {
    const header = [
      "순위",
      "승식",
      "조합",
      "마번",
      "마명",
      "모델확률",
      "배당률",
      "암시확률",
      "Edge",
      "EV",
      "EV%",
      "기대반환값",
      "추천등급",
    ].join(",");
    const lines = filtered.map((r, i) =>
      [
        i + 1,
        r.bet_type,
        r.combination_key,
        `"${r.horse_numbers.join(",")}"`,
        `"${r.horse_numbers.map((n) => horseNameMap[n] ?? "").join(",")}"`,
        r.probability.toFixed(4),
        r.odds.toFixed(2),
        r.implied_probability.toFixed(4),
        r.edge.toFixed(4),
        r.ev.toFixed(4),
        r.ev_percent.toFixed(2),
        r.expected_return.toFixed(4),
        r.recommendation,
      ].join(","),
    );
    const blob = new Blob(["\ufeff" + [header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ev_${raceId}.csv`;
    a.click();
  };

  if (!snap || !run) {
    return (
      <Card>
        <CardContent className="space-y-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {!snap && "배당률 스냅샷이 없습니다. "}{!run && "모델 확률이 없습니다."}
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild variant="secondary">
              <Link to="/races/$raceId" params={{ raceId }} search={{ tab: "odds" }}>
                배당률 입력
              </Link>
            </Button>
            <Button asChild>
              <Link to="/races/$raceId" params={{ raceId }} search={{ tab: "probs" }}>
                모델 확률 입력
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="전체 후보" value={summary.total.toString()} />
        <SummaryCard
          label="EV 양수 후보"
          value={summary.positive.toString()}
          accent={summary.positive > 0}
        />
        <SummaryCard label="최고 EV" value={fmtEvPct(summary.maxEv * 100)} accent={summary.maxEv > 0} />
        <SummaryCard label="최고 Edge" value={fmtPct(summary.maxEdge)} accent={summary.maxEdge > 0} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1">
            <Label className="text-xs">승식</Label>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as "전체" | BetType)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체</SelectItem>
                {BET_TYPES.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">최소 모델 확률</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0~1"
              className="w-28"
              value={minProb}
              onChange={(e) => setMinProb(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">최소 배당률</Label>
            <Input
              type="number"
              step="0.1"
              className="w-28"
              value={minOdds}
              onChange={(e) => setMinOdds(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={onlyPositive} onCheckedChange={setOnlyPositive} id="pos" />
            <Label htmlFor="pos" className="text-xs">
              EV 양수만 보기
            </Label>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={downloadCsv}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button size="sm" onClick={saveResults}>
              <Save className="h-4 w-4" /> 결과 저장
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        분석 기준 스냅샷: {new Date(snap.captured_at).toLocaleString("ko-KR")}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">순위</th>
              <th className="px-3 py-2 text-left">승식</th>
              <th className="px-3 py-2 text-left">조합</th>
              <th className="px-3 py-2 text-left">마번</th>
              <th className="px-3 py-2 text-left">마명</th>
              <th className="px-3 py-2 text-right">모델 확률</th>
              <th className="px-3 py-2 text-right">배당률</th>
              <th className="px-3 py-2 text-right">암시확률</th>
              <th className="px-3 py-2 text-right">Edge</th>
              <th className="px-3 py-2 text-right">EV</th>
              <th className="px-3 py-2 text-right">EV%</th>
              <th className="px-3 py-2 text-right">기대반환값</th>
              <th className="px-3 py-2 text-center">추천 등급</th>
              <th className="px-3 py-2 text-left">메모</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={14} className="px-3 py-10 text-center text-muted-foreground">
                  결과 없음. 필터를 완화하거나 데이터를 입력하세요.
                </td>
              </tr>
            )}
            {filtered.map((r, i) => {
              const rowClass =
                r.ev > 0.25
                  ? "row-ev-strong"
                  : r.ev > 0
                    ? "row-ev-positive"
                    : "row-ev-negative";
              return (
                <tr key={`${r.bet_type}-${r.combination_key}`} className={`border-t ${rowClass}`}>
                  <td className="px-3 py-2 num font-semibold">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{r.bet_type}</Badge>
                  </td>
                  <td className="px-3 py-2 num">{r.combination_key}</td>
                  <td className="px-3 py-2 text-muted-foreground num">{r.horse_numbers.join(", ")}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.horse_numbers.map((n) => horseNameMap[n] ?? "?").join(", ")}
                  </td>
                  <td className="px-3 py-2 text-right num">{fmtPct(r.probability)}</td>
                  <td className="px-3 py-2 text-right num font-medium">{fmtOdds(r.odds)}</td>
                  <td className="px-3 py-2 text-right num text-muted-foreground">
                    {fmtPct(r.implied_probability)}
                  </td>
                  <td className="px-3 py-2 text-right num">{fmtPct(r.edge)}</td>
                  <td className="px-3 py-2 text-right num">{r.ev.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right num font-semibold">
                    {fmtEvPct(r.ev_percent)}
                  </td>
                  <td className="px-3 py-2 text-right num">{r.expected_return.toFixed(3)}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${recommendationVariant(r.recommendation as never)}`}
                    >
                      {r.recommendation}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">-</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={`mt-1 text-2xl font-bold num ${accent ? "text-success" : ""}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

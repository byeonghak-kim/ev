import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Database, Sparkles } from "lucide-react";
import { syncKraPublicData, updateSimpleModel } from "@/lib/public-data.functions";

export const Route = createFileRoute("/data")({
  component: DataPage,
  head: () => ({
    meta: [
      { title: "데이터 관리 — 경마 EV 계산기" },
      { name: "description", content: "공공데이터 업데이트 및 간이 통계 모델 갱신" },
    ],
  }),
});

type SyncLog = {
  id: string;
  sync_finished_at: string | null;
  status: string | null;
  inserted_count: number | null;
  skipped_count: number | null;
  fetched_count: number | null;
  error_message: string | null;
};
type ModelLog = {
  id: string;
  created_at: string;
  status: string | null;
  trained_data_count: number | null;
  generated_probability_count: number | null;
  error_message: string | null;
};
type RaceOpt = { id: string; race_date: string; venue: string; race_no: number };

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function DataPage() {
  const syncFn = useServerFn(syncKraPublicData);
  const modelFn = useServerFn(updateSimpleModel);

  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(today.getDate() - 30);
  const [dateFrom, setDateFrom] = useState(fmtDate(monthAgo));
  const [dateTo, setDateTo] = useState(fmtDate(today));
  const [syncing, setSyncing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [lastSync, setLastSync] = useState<SyncLog | null>(null);
  const [lastModel, setLastModel] = useState<ModelLog | null>(null);
  const [resultCount, setResultCount] = useState<number>(0);
  const [hasKey, setHasKey] = useState<boolean>(true);

  const [races, setRaces] = useState<RaceOpt[]>([]);
  const [selectedRace, setSelectedRace] = useState<string>("");

  async function reload() {
    const [{ data: sLogs }, { data: mLogs }, { count }, { data: rs }] = await Promise.all([
      supabase
        .from("public_data_sync_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("model_update_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.from("public_race_results").select("id", { count: "exact", head: true }),
      supabase
        .from("races")
        .select("id,race_date,venue,race_no")
        .order("race_date", { ascending: false })
        .order("race_no", { ascending: false })
        .limit(30),
    ]);
    setLastSync(((sLogs ?? [])[0] as SyncLog) ?? null);
    setLastModel(((mLogs ?? [])[0] as ModelLog) ?? null);
    setResultCount(count ?? 0);
    setRaces((rs ?? []) as RaceOpt[]);
    if (!selectedRace && rs && rs[0]) setSelectedRace(rs[0].id);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSync() {
    setSyncing(true);
    try {
      const res = await syncFn({ data: { dateFrom, dateTo } });
      if (!res.ok) {
        toast.error(res.error ?? "업데이트에 실패했습니다.");
        if (res.error?.includes("DATA_GO_KR_SERVICE_KEY")) setHasKey(false);
      } else {
        toast.success(
          `업데이트 완료: 신규 ${res.inserted}건 추가, 중복 ${res.skipped}건 제외 (조회 ${res.fetched}건)`,
        );
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
      reload();
    }
  }

  async function onUpdateModel() {
    if (!selectedRace) {
      toast.error("대상 경주를 선택하세요.");
      return;
    }
    setUpdating(true);
    try {
      const res = await modelFn({ data: { raceId: selectedRace } });
      if (!res.ok) {
        toast.error(res.error ?? "모델 갱신에 실패했습니다.");
      } else {
        toast.success(
          `간이 모델 갱신 완료: ${res.generated}개 확률 생성 (학습 데이터 ${res.trainedCount}건)`,
        );
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUpdating(false);
      reload();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">데이터 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          이 기능은 공공데이터포털의 과거 경주결과를 가져와 간이 통계 모델을 갱신합니다. 실시간
          배당률은 더비온 캡처 이미지 또는 수동 입력값을 사용합니다.
        </p>
      </div>

      {!hasKey && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            DATA_GO_KR_SERVICE_KEY가 Lovable Cloud Secrets에 설정되어 있지 않습니다.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="마지막 업데이트"
          value={
            lastSync?.sync_finished_at
              ? new Date(lastSync.sync_finished_at).toLocaleString("ko-KR")
              : "—"
          }
          sub={lastSync?.status ?? ""}
        />
        <StatCard
          label="누적 경주결과"
          value={`${resultCount.toLocaleString()}건`}
          sub={lastSync ? `최근 +${lastSync.inserted_count ?? 0} / 중복 ${lastSync.skipped_count ?? 0}` : ""}
        />
        <StatCard
          label="마지막 모델 갱신"
          value={
            lastModel ? new Date(lastModel.created_at).toLocaleString("ko-KR") : "—"
          }
          sub={lastModel?.status ?? ""}
        />
        <StatCard
          label="생성된 확률"
          value={`${lastModel?.generated_probability_count ?? 0}개`}
          sub={lastModel ? `학습 ${lastModel.trained_data_count ?? 0}건` : ""}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" /> 공공데이터 관리
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="dateFrom">시작일</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateTo">종료일</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button onClick={onSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              공공데이터 업데이트
            </Button>
          </div>
          {lastSync?.error_message && (
            <p className="text-xs text-destructive">최근 오류: {lastSync.error_message}</p>
          )}

          <div className="border-t pt-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label>대상 경주</Label>
                <Select value={selectedRace} onValueChange={setSelectedRace}>
                  <SelectTrigger>
                    <SelectValue placeholder="경주 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {races.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.race_date} · {r.venue} {r.race_no}R
                      </SelectItem>
                    ))}
                    {races.length === 0 && (
                      <SelectItem value="__none" disabled>
                        등록된 경주가 없습니다
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={onUpdateModel} disabled={updating || !selectedRace}>
                {updating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                간이 모델 갱신
              </Button>
            </div>
            {lastModel?.error_message && (
              <p className="mt-2 text-xs text-destructive">최근 오류: {lastModel.error_message}</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              선택한 경주의 출전마/기수/조교사 이름을 공공데이터에서 찾아 간이 점수
              (말 복승률·기수 복승률·조교사 복승률·최근 출전 활성도)를 합산해 단승 모델 확률을
              생성합니다. EV 결과 탭에서 새 모델 런을 선택하면 즉시 반영됩니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-semibold tracking-tight">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

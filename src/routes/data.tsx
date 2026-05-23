import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, RefreshCw, Calculator, ShieldCheck, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  addSamplePublicData,
  loadDataMgmtStats,
  recomputeEv,
  refreshSimpleModel,
  type DataMgmtStats,
} from "@/lib/data-mgmt";

export const Route = createFileRoute("/data")({
  component: DataMgmtPage,
  head: () => ({
    meta: [
      { title: "공공데이터 및 모델 관리 — 경마 EV 계산기" },
      {
        name: "description",
        content:
          "MVP용 샘플 공공데이터를 추가하고, 간이 통계 모델을 갱신하며, 최신 배당률과 모델 확률로 EV 결과를 다시 계산합니다.",
      },
      { property: "og:title", content: "공공데이터 및 모델 관리 — 경마 EV 계산기" },
      {
        property: "og:description",
        content:
          "샘플 공공데이터 동기화, 간이 통계 모델 갱신, EV 재계산을 한 화면에서 수행합니다.",
      },
    ],
  }),
});

function fmtDt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function DataMgmtPage() {
  const [stats, setStats] = useState<DataMgmtStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"sample" | "model" | "ev" | null>(null);
  const [lastEvRaceId, setLastEvRaceId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await loadDataMgmtStats());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAddSample = async () => {
    setBusy("sample");
    try {
      const r = await addSamplePublicData();
      if (!r.ok) {
        toast.error(`샘플 추가 실패: ${r.error}`);
      } else if (r.inserted === 0) {
        toast.message("이미 추가된 샘플 데이터입니다", {
          description: `중복 ${r.skipped}건은 건너뛰었습니다.`,
        });
      } else {
        toast.success("샘플 공공데이터가 추가되었습니다", {
          description: `추가 ${r.inserted}건 / 중복 ${r.skipped}건`,
        });
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const onRefreshModel = async () => {
    setBusy("model");
    try {
      const r = await refreshSimpleModel();
      if (!r.ok) toast.error(`간이 모델 갱신 실패: ${r.error}`);
      else
        toast.success("간이 모델 갱신 완료", {
          description: `버전 ${r.version} · 확률 ${r.rows}건 · 대상 경주 ${r.raceId.slice(0, 8)}…`,
        });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const onRecomputeEv = async () => {
    setBusy("ev");
    try {
      const r = await recomputeEv();
      if (!r.ok) {
        toast.error(`EV 재계산 실패: ${r.error}`);
        setLastEvRaceId(null);
      } else {
        toast.success(`EV 결과 ${r.rows}건 저장 (EV 내림차순)`);
        setLastEvRaceId(r.raceId);
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-gradient-to-br from-accent/60 to-card p-6">
        <h1 className="text-2xl font-bold tracking-tight">공공데이터 및 모델 관리</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          현재 버전은 제출용 MVP입니다. 공공데이터는 샘플 동기화 방식으로만 처리합니다.
          실시간 배당률은 더비온 캡처 이미지 또는 수동 입력값을 사용합니다.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">저장된 샘플 공공데이터</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "…" : stats?.publicCount ?? 0}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">마지막 샘플 동기화</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{fmtDt(stats?.lastSyncAt ?? null)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">마지막 간이 모델 갱신</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{fmtDt(stats?.lastModelUpdateAt ?? null)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">최신 모델 버전</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="truncate text-sm font-mono">{stats?.latestModelVersion ?? "—"}</div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" /> 샘플 공공데이터 20건 추가
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              외부 API 호출 없이 결정론적 샘플 20건을 추가합니다. 동일 키는 자동으로 건너뜁니다.
            </p>
            <Button onClick={onAddSample} disabled={busy !== null} className="w-full">
              {busy === "sample" ? "추가 중…" : "샘플 20건 추가"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" /> 간이 모델 갱신
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              샘플 공공데이터의 말/기수/조교사 입상률을 가중합(0.4/0.3/0.3)하여 단승 확률을 생성합니다.
            </p>
            <Button onClick={onRefreshModel} disabled={busy !== null} className="w-full" variant="secondary">
              {busy === "model" ? "갱신 중…" : "간이 모델 갱신"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" /> EV 결과 다시 계산
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              가장 최신 배당률 스냅샷과 모델 런을 기준으로 EV 결과를 새 버전으로 저장합니다. 기본 정렬은 EV 내림차순.
            </p>
            <Button onClick={onRecomputeEv} disabled={busy !== null} className="w-full" variant="secondary">
              {busy === "ev" ? "계산 중…" : "EV 다시 계산"}
            </Button>
            {lastEvRaceId && (
              <Link
                to="/races/$raceId"
                params={{ raceId: lastEvRaceId }}
                search={{ tab: "ev" }}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
              >
                결과 보러가기 <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-success" /> 보안 상태
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm sm:grid-cols-3">
              <li className="rounded-md border bg-success/5 px-3 py-2">✅ RLS 적용</li>
              <li className="rounded-md border bg-success/5 px-3 py-2">✅ Storage overwrite 금지</li>
              <li className="rounded-md border bg-success/5 px-3 py-2">✅ Public listing 금지</li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              모든 테이블은 anon UPDATE/DELETE가 차단되며, 캡처 이미지는 private 버킷 + signed URL로만 접근합니다.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

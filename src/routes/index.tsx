import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, PlusCircle, History, ChevronRight, Trash2 } from "lucide-react";
import { createSampleRace } from "@/lib/sample";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "경마 EV 계산기 — 홈" },
      {
        name: "description",
        content:
          "샘플 경주로 EV 계산 흐름을 바로 체험해 보세요. 모델 확률과 배당률을 비교해 후보를 정렬합니다.",
      },
    ],
  }),
});

type RaceRow = {
  id: string;
  race_date: string;
  venue: string;
  race_no: number;
  created_at: string;
};

function Home() {
  const navigate = useNavigate();
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const { data } = await supabase
      .from("races")
      .select("id, race_date, venue, race_no, created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    setRaces((data as RaceRow[]) ?? []);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onMakeSample = async () => {
    setLoading(true);
    try {
      const raceId = await createSampleRace();
      toast.success("샘플 경주 생성 완료");
      navigate({ to: "/races/$raceId", params: { raceId }, search: { tab: "ev" } });
    } catch (e) {
      console.error(e);
      toast.error("샘플 경주 생성 실패");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("이 경주와 관련 데이터를 모두 삭제하시겠습니까?")) return;
    await supabase.from("ev_results").delete().eq("race_id", id);
    await supabase.from("model_probabilities").delete().eq("race_id", id);
    await supabase.from("model_runs").delete().eq("race_id", id);
    await supabase.from("odds_entries").delete().eq("race_id", id);
    await supabase.from("odds_snapshots").delete().eq("race_id", id);
    await supabase.from("horses").delete().eq("race_id", id);
    const { error } = await supabase.from("races").delete().eq("id", id);
    if (error) toast.error("삭제 실패");
    else {
      toast.success("삭제됨");
      void refresh();
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-gradient-to-br from-accent/60 to-card p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> EV 기반 분석 프로토타입
            </span>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              모델 확률 × 실시간 배당률 → EV 정렬
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              이 도구는 특정 경주 결과를 예측하지 않습니다. 사용자가 입력한 모델 확률과
              배당률을 비교해 기대값이 높은 후보를 내림차순으로 보여줍니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={onMakeSample} disabled={loading}>
              <Sparkles className="h-4 w-4" />
              {loading ? "생성 중..." : "샘플 경주 만들기"}
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/races/new">
                <PlusCircle className="h-4 w-4" /> 새 경주 만들기
              </Link>
            </Button>
          </div>
        </div>
        <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          공용 프로토타입입니다. 민감한 개인정보를 입력하지 마세요. 모든 데이터는 누구나 볼 수 있습니다.
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">최근 경주</h2>
          <Link
            to="/history"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <History className="h-3.5 w-3.5" /> 전체 히스토리
          </Link>
        </div>

        {races.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              아직 경주가 없습니다. 위의 <b>샘플 경주 만들기</b> 버튼으로 바로 시작해 보세요.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {races.map((r) => (
              <Link key={r.id} to="/races/$raceId" params={{ raceId: r.id }} search={{ tab: "ev" }}>
                <Card className="transition hover:border-primary hover:shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>
                        {r.venue} · {r.race_no}R
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    경주일 {r.race_date}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

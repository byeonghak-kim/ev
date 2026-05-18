import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "히스토리 — 경마 EV 계산기" },
      { name: "description", content: "과거 경주와 저장된 EV 결과를 다시 봅니다." },
    ],
  }),
});

type RaceItem = {
  id: string;
  race_date: string;
  venue: string;
  race_no: number;
  created_at: string;
};

function HistoryPage() {
  const [items, setItems] = useState<RaceItem[]>([]);
  const [counts, setCounts] = useState<Record<string, { snaps: number; evs: number }>>({});

  const load = async () => {
    const { data } = await supabase
      .from("races")
      .select("id, race_date, venue, race_no, created_at")
      .order("created_at", { ascending: false });
    const list = (data as RaceItem[]) ?? [];
    setItems(list);
    if (list.length) {
      const ids = list.map((r) => r.id);
      const [{ data: snaps }, { data: evs }] = await Promise.all([
        supabase.from("odds_snapshots").select("race_id").in("race_id", ids),
        supabase.from("ev_results").select("race_id").in("race_id", ids),
      ]);
      const c: Record<string, { snaps: number; evs: number }> = {};
      (snaps ?? []).forEach((s: { race_id: string }) => {
        c[s.race_id] = c[s.race_id] ?? { snaps: 0, evs: 0 };
        c[s.race_id].snaps++;
      });
      (evs ?? []).forEach((e: { race_id: string }) => {
        c[e.race_id] = c[e.race_id] ?? { snaps: 0, evs: 0 };
        c[e.race_id].evs++;
      });
      setCounts(c);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const remove = async (id: string) => {
    if (!confirm("이 경주를 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.")) return;
    const { error } = await supabase.from("races").delete().eq("id", id);
    if (error) toast.error("삭제 실패");
    else {
      toast.success("삭제됨");
      void load();
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">히스토리</h1>
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            기록된 경주가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => {
            const c = counts[r.id] ?? { snaps: 0, evs: 0 };
            return (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <Link
                      to="/races/$raceId"
                      params={{ raceId: r.id }}
                      search={{ tab: "ev" }}
                      className="hover:text-primary"
                    >
                      {r.venue} · {r.race_no}R
                    </Link>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  <div>경주일 {r.race_date}</div>
                  <div className="mt-1">
                    스냅샷 {c.snaps}건 · 저장된 EV 결과 {c.evs}건
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

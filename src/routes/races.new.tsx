import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/races/new")({
  component: NewRace,
  head: () => ({
    meta: [
      { title: "새 경주 만들기 — 경마 EV 계산기" },
      { name: "description", content: "경주일, 경마장, 경주 번호 등 기본 정보를 입력해 새 경주를 만듭니다." },
    ],
  }),
});

function NewRace() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    race_date: new Date().toISOString().slice(0, 10),
    venue: "서울",
    race_no: 1,
    distance_m: 1400,
    track_condition: "양호",
    weather: "맑음",
    memo: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("races")
        .insert(form)
        .select("id")
        .single();
      if (error) throw error;
      toast.success("경주 생성 완료");
      navigate({
        to: "/races/$raceId",
        params: { raceId: data!.id },
        search: { tab: "horses" },
      });
    } catch (err) {
      console.error(err);
      toast.error("경주 생성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>새 경주 만들기</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>경주일</Label>
              <Input
                type="date"
                value={form.race_date}
                onChange={(e) => setForm({ ...form, race_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>경마장</Label>
              <Select
                value={form.venue}
                onValueChange={(v) => setForm({ ...form, venue: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="서울">서울</SelectItem>
                  <SelectItem value="부산경남">부산경남</SelectItem>
                  <SelectItem value="제주">제주</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>경주 번호</Label>
              <Input
                type="number"
                min={1}
                value={form.race_no}
                onChange={(e) => setForm({ ...form, race_no: +e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>거리 (m)</Label>
              <Input
                type="number"
                value={form.distance_m}
                onChange={(e) => setForm({ ...form, distance_m: +e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>주로 상태</Label>
              <Select
                value={form.track_condition}
                onValueChange={(v) => setForm({ ...form, track_condition: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["양호", "다습", "포화", "불량"].map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>날씨</Label>
              <Select
                value={form.weather}
                onValueChange={(v) => setForm({ ...form, weather: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["맑음", "흐림", "비", "눈", "안개"].map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>메모</Label>
              <Textarea
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                rows={3}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "생성 중..." : "경주 만들기"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

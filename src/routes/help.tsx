import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/help")({
  component: HelpPage,
  head: () => ({
    meta: [
      { title: "도움말 — 경마 EV 계산기" },
      { name: "description", content: "EV, 암시확률, Edge 등 계산식과 사용법 설명" },
    ],
  }),
});

function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">도움말 / 계산식</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 공식</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <b>암시확률 (implied probability)</b> = 1 / 배당률
          </p>
          <p>
            <b>EV (기대값)</b> = 모델 확률 × 배당률 − 1
          </p>
          <p>
            <b>EV%</b> = EV × 100
          </p>
          <p>
            <b>Edge</b> = 모델 확률 − 암시확률
          </p>
          <p>
            <b>기대반환값</b> = 모델 확률 × 배당률
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">예시</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>모델 확률 0.25, 배당률 5.0 → EV = 0.25 × 5.0 − 1 = 0.25</p>
          <p>EV% = +25.0%, 즉 장기적으로 1원 베팅당 기대수익 0.25원.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">추천 등급 기준</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>• EV ≤ 0: <b>제외</b></p>
          <p>• 0 &lt; EV ≤ 0.1: <b>관찰</b></p>
          <p>• 0.1 &lt; EV ≤ 0.25: <b>후보</b></p>
          <p>• EV &gt; 0.25: <b>강한 후보</b></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">유의 사항</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>이 앱은 확률 계산 도구이며 수익을 보장하지 않습니다.</p>
          <p>모델 확률은 사용자가 입력한 값이며, 실제 결과와 다를 수 있습니다.</p>
          <p>공용 프로토타입이므로 민감한 정보는 입력하지 마세요.</p>
        </CardContent>
      </Card>
    </div>
  );
}

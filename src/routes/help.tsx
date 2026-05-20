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
          <p><b>암시확률 (implied probability)</b> = 1 / 배당률</p>
          <p><b>EV (기대값)</b> = 모델 확률 × 배당률 − 1</p>
          <p><b>EV%</b> = EV × 100</p>
          <p><b>Edge</b> = 모델 확률 − 암시확률</p>
          <p><b>기대반환값</b> = 모델 확률 × 배당률</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">모델 확률이란?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <b>모델 확률</b>은 특정 베팅(예: "단승 5번", "복승 1-3")이 적중할 것이라고
            <b> 내(또는 모델)가 추정한 확률</b>이다. 0과 1 사이의 값.
          </p>
          <p>
            배당률에서 나온 <b>암시확률(1/배당률)</b>은 시장(다른 베터들)의 컨센서스를
            반영한 값이며, 모델 확률과는 다르다. EV는 이 둘의 차이에서 발생한다.
          </p>
          <p>입력 방법은 두 가지:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><b>수동 입력</b>: 모델 확률 탭에서 직접 입력하거나 CSV로 가져오기.</li>
            <li>
              <b>자동 추론</b>: 모델 확률 탭의 <b>"새 모델 런"</b> 버튼을 누르면 활성 단승
              배당률 스냅샷을 기반으로 모든 베팅 종목 후보의 확률이 자동 계산된다(Harville 모델).
              단승 배당이 입력되어 있어야 한다.
            </li>
          </ul>
          <p className="text-muted-foreground">
            자동 추론은 시장 배당을 출발점으로 한 근사이며, 완벽한 예측이 아니다.
            본인 모델·핸디캡 분석으로 개별 항목을 덮어쓰면 더 정확한 EV가 나온다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">후보(베팅 경우의 수)는 몇 개인가?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            N두 경주에서 종목별 이론 후보 수는 다음과 같다.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">종목</th>
                  <th className="px-3 py-2 text-left">정의</th>
                  <th className="px-3 py-2 text-right">N=12</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t"><td className="px-3 py-2">단승</td><td className="px-3 py-2">1위 (N)</td><td className="px-3 py-2 text-right num">12</td></tr>
                <tr className="border-t"><td className="px-3 py-2">연승</td><td className="px-3 py-2">3위 이내 (N)</td><td className="px-3 py-2 text-right num">12</td></tr>
                <tr className="border-t"><td className="px-3 py-2">복승</td><td className="px-3 py-2">1·2위 무순 (NC2)</td><td className="px-3 py-2 text-right num">66</td></tr>
                <tr className="border-t"><td className="px-3 py-2">쌍승</td><td className="px-3 py-2">1·2위 유순 (NP2)</td><td className="px-3 py-2 text-right num">132</td></tr>
                <tr className="border-t"><td className="px-3 py-2">복연승</td><td className="px-3 py-2">2마리 모두 3위 이내 (NC2)</td><td className="px-3 py-2 text-right num">66</td></tr>
                <tr className="border-t"><td className="px-3 py-2">삼복승</td><td className="px-3 py-2">1·2·3위 무순 (NC3)</td><td className="px-3 py-2 text-right num">220</td></tr>
                <tr className="border-t"><td className="px-3 py-2">삼쌍승</td><td className="px-3 py-2">1·2·3위 유순 (NP3)</td><td className="px-3 py-2 text-right num">1,320</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            즉 N=12일 때 합산 약 <b>1,800개 이상</b>의 후보가 존재한다.
            <b>"새 모델 런"</b>을 누르면 출전 두수에 맞춰 모든 종목 후보가 한 번에
            생성되고, EV 탭에서 내림차순으로 정렬된다.
          </p>
          <p className="text-muted-foreground">
            조합 폭발을 막기 위해 각 종목당 상위 400개로 절단된다.
            샘플 경주(데모용)는 단승·복승 16건만 시드하므로 적게 보이는 것이며,
            실제 경주에서는 자동 추론으로 수백~수천 후보가 채워진다.
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

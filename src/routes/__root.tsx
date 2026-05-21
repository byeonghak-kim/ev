import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "경마 EV 계산기" },
      {
        name: "description",
        content:
          "한국 경마 배당률과 모델 확률을 비교해 EV(기대값) 기준으로 베팅 후보를 정렬해 보여주는 도구",
      },
      { property: "og:title", content: "경마 EV 계산기" },
      { name: "twitter:title", content: "경마 EV 계산기" },
      { name: "description", content: "경마 EV 계산기: 모델 확률과 실시간 배당률 비교로 고배당 베팅 후보를 찾습니다." },
      { property: "og:description", content: "경마 EV 계산기: 모델 확률과 실시간 배당률 비교로 고배당 베팅 후보를 찾습니다." },
      { name: "twitter:description", content: "경마 EV 계산기: 모델 확률과 실시간 배당률 비교로 고배당 베팅 후보를 찾습니다." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/69656ce3-5f9d-43d5-bdeb-6676e97957c6/id-preview-ca8c4d7d--d738e5fd-aa6f-40bb-9a2f-935961cc4cbb.lovable.app-1779276450722.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/69656ce3-5f9d-43d5-bdeb-6676e97957c6/id-preview-ca8c4d7d--d738e5fd-aa6f-40bb-9a2f-935961cc4cbb.lovable.app-1779276450722.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">페이지를 찾을 수 없습니다.</p>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          홈으로
        </Link>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-bold">
                EV
              </span>
              <span className="font-semibold tracking-tight">경마 EV 계산기</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                to="/"
                activeOptions={{ exact: true }}
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                activeProps={{ className: "rounded-md px-3 py-1.5 bg-accent text-foreground font-medium" }}
              >
                홈
              </Link>
              <Link
                to="/data"
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                activeProps={{ className: "rounded-md px-3 py-1.5 bg-accent text-foreground font-medium" }}
              >
                데이터
              </Link>
              <Link
                to="/history"
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                activeProps={{ className: "rounded-md px-3 py-1.5 bg-accent text-foreground font-medium" }}
              >
                히스토리
              </Link>

              <Link
                to="/help"
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                activeProps={{ className: "rounded-md px-3 py-1.5 bg-accent text-foreground font-medium" }}
              >
                도움말
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-muted-foreground">
          이 앱은 베팅 조언이 아니라 기대값(EV) 계산 도구입니다. 수익을 보장하지 않습니다.
        </footer>
        <Toaster position="top-center" richColors />
      </div>
    </QueryClientProvider>
  );
}

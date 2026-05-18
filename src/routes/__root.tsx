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

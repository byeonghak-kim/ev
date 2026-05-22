// 익명 사용자 세션 ID. 브라우저 localStorage에 저장.
// RLS 정책에서 INSERT 시 app_session_id 유효성 검증에 사용.
const KEY = "app_session_id";

export function getAppSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id || id.length < 20) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // localStorage 차단 환경(예: SSR/시크릿모드 일부) 대비
    return `s-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
}

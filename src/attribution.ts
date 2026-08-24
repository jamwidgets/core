const SESSION_KEY = "jamwidgets_session_id";

function createSessionId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSessionId(): string {
  if (typeof window === "undefined") return createSessionId();

  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = createSessionId();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return createSessionId();
  }
}

export function getAttributionHeaders(path?: string): Record<string, string> {
  if (typeof window === "undefined") return {};

  return {
    "X-Jamwidgets-Session": getSessionId(),
    "X-Jamwidgets-Path": path ?? window.location.pathname,
  };
}

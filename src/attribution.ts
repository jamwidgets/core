import { generateUUID } from "./uuid.js";

const SESSION_KEY = "jamwidgets_session_id";
let fallbackSessionId: string | null = null;

export function getSessionId(): string {
  if (typeof window === "undefined") return generateUUID();
  let id = "";
  let storageBlocked = false;
  try { id = sessionStorage.getItem(SESSION_KEY) || ""; } catch { storageBlocked = true; }
  if (id) return id;
  id = fallbackSessionId ?? generateUUID();
  try { sessionStorage.setItem(SESSION_KEY, id); } catch { storageBlocked = true; }
  fallbackSessionId = storageBlocked ? id : null;
  return id;
}

export function getAttributionHeaders(path?: string): Record<string, string> {
  if (typeof window === "undefined") return {};

  return {
    "X-Jamwidgets-Session": getSessionId(),
    "X-Jamwidgets-Path": path ?? window.location.pathname,
  };
}

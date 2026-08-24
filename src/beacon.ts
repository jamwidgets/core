import {
  API_PATH,
  DEFAULT_ENDPOINT,
  getConfigFromMeta,
  type JamWidgetsConfig,
} from "./index";
import { getSessionId } from "./attribution";

export interface TrackPageviewOptions extends Partial<JamWidgetsConfig> {
  /** Path to record. Defaults to `location.pathname`. */
  path?: string;
}

export function trackPageview(options: TrackPageviewOptions = {}): void {
  if (typeof window === "undefined") return;

  const meta = getConfigFromMeta();
  const siteKey = options.siteKey || meta?.siteKey;
  if (!siteKey) return;

  const endpoint = options.endpoint || meta?.endpoint || DEFAULT_ENDPOINT;
  const url = `${endpoint.replace(/\/+$/, "")}${API_PATH}/e`;
  const path = options.path ?? window.location.pathname;

  try {
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-jamwidgets-key": siteKey },
      body: JSON.stringify({ path, sessionId: getSessionId() }),
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // Analytics must not break its host page if fetch throws synchronously.
  }
}

let started = false;

export function initAnalytics(options: TrackPageviewOptions = {}): void {
  if (started || typeof window === "undefined") return;
  started = true;

  let lastPath = "";
  const fire = () => {
    const path = options.path ?? window.location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    trackPageview({ ...options, path });
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", fire, { once: true });
  } else {
    fire();
  }

  const patch = (name: "pushState" | "replaceState") => {
    const original = history[name];
    history[name] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      fire();
      return result;
    };
  };
  patch("pushState");
  patch("replaceState");
  window.addEventListener("popstate", fire);
}

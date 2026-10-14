import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAnnouncements, widgetFetch } from "../src/index.js";

function response(status: number, headers: Record<string, string> = {}, body: unknown = []): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("widgetFetch", () => {
  it("retries a 429 once after Retry-After", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(429, { "Retry-After": "1" }))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetch);

    const pending = widgetFetch("https://jamwidgets.test/api/v1/site");
    await vi.advanceTimersByTimeAsync(999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("caps a long Retry-After at two seconds", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(429, { "Retry-After": "120" }))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetch);

    const pending = widgetFetch("https://jamwidgets.test/api/v1/site");
    await vi.advanceTimersByTimeAsync(2000);
    expect((await pending).status).toBe(200);
  });

  it("surfaces a second 429 instead of retrying again", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(response(429, { "Retry-After": "1" }, { message: "Too many requests" }));
    vi.stubGlobal("fetch", fetch);

    const pending = fetchAnnouncements({ siteKey: "key", endpoint: "https://jamwidgets.test" });
    const rejected = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry other statuses", async () => {
    const fetch = vi.fn().mockResolvedValue(response(500));
    vi.stubGlobal("fetch", fetch);
    expect((await widgetFetch("https://jamwidgets.test/api/v1/site")).status).toBe(500);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

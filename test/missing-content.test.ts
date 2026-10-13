import { afterEach, describe, expect, it, vi } from "vitest";

import { JamwidgetsGalleryElement, JamwidgetsRandomPhotoElement } from "../src/gallery-elements.js";
import { isNotFound, JamwidgetsApiError, PollController, warnMissingContent } from "../src/index.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isNotFound", () => {
  it("is true only for a 404 from the API", () => {
    expect(isNotFound(new JamwidgetsApiError("missing", 404))).toBe(true);
    expect(isNotFound(new JamwidgetsApiError("broken", 500))).toBe(false);
    expect(isNotFound(new Error("network"))).toBe(false);
  });
});

describe("warnMissingContent", () => {
  it("warns once per widget and slug, naming both and the fix", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnMissingContent("Poll", "once-only");
    warnMissingContent("Poll", "once-only");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Poll "once-only"');
    expect(warn.mock.calls[0][0]).toContain("Jamwidgets dashboard");
  });
});

describe("PollController", () => {
  it("hides a missing poll: status notFound, no error, a console warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = vi.fn().mockResolvedValue(jsonResponse(404, { message: "poll not found", code: "notFound" }));
    vi.stubGlobal("fetch", fetch);

    const controller = new PollController({ siteKey: "sk-acme", endpoint: "https://jw.example" }, "no such/poll");
    await expect(controller.fetch()).resolves.toBeNull();

    expect(controller.getState()).toMatchObject({ poll: null, status: "notFound", error: null });
    expect(fetch.mock.calls[0][0]).toBe("https://jw.example/api/v1/polls/no%20such%2Fpoll");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Poll "no such/poll"'));
  });

  it("still reports a server error as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { message: "database unavailable" })));

    const controller = new PollController({ siteKey: "sk-acme", endpoint: "https://jw.example" }, "broken-poll");
    await expect(controller.fetch()).rejects.toThrow("database unavailable");

    const state = controller.getState();
    expect(state.status).toBe("error");
    expect(state.error).toBeInstanceOf(JamwidgetsApiError);
  });
});

// The custom elements run without a DOM here; give them just what load() touches.
function element<T extends object>(Element: new () => T, attributes: Record<string, string>) {
  const el = new Element() as T & {
    load(generation: number): Promise<void>;
    fail: (error: unknown) => void;
    hidden: boolean;
  };
  Object.assign(el, {
    isConnected: true,
    getAttribute: (name: string) => attributes[name] ?? null,
    fail: vi.fn(),
  });
  return el;
}

describe("gallery elements", () => {
  it("hide a missing gallery instead of showing an error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, {})));

    const el = element(JamwidgetsGalleryElement, { "site-key": "sk-acme", slug: "missing-gallery" });
    await el.load(0);

    expect(el.hidden).toBe(true);
    expect(el.fail).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Gallery "missing-gallery"'));
  });

  it("hide a random photo with nothing to pick from", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, {})));

    const el = element(JamwidgetsRandomPhotoElement, { "site-key": "sk-acme", slug: "empty-gallery" });
    await el.load(0);

    expect(el.hidden).toBe(true);
    expect(el.fail).not.toHaveBeenCalled();
  });

  it("still show server errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { message: "storage offline" })));

    const el = element(JamwidgetsGalleryElement, { "site-key": "sk-acme", slug: "field-notes" });
    await el.load(0);

    expect(el.hidden).not.toBe(true);
    expect(el.fail).toHaveBeenCalledWith(expect.objectContaining({ message: "storage offline" }));
  });
});

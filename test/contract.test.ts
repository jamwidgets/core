import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import * as core from "../src/index.js";

// The widget API's OpenAPI document, regenerated from the Go server and kept
// current by CI. Every request core makes must match it. The standalone
// package mirror doesn't carry the server, so those checks run in the monorepo.
const specPath = new URL("../../../go-server/openapi/openapi.json", import.meta.url);
const hasSpec = existsSync(specPath);
type Schema = Record<string, unknown>;
interface Operation {
  parameters?: Array<{ name: string; in: string }>;
  requestBody?: { content: Record<string, { schema: Schema }> };
}
interface OpenAPI {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
}

let spec: OpenAPI;

beforeAll(async () => {
  if (hasSpec) spec = JSON.parse(await readFile(specPath, "utf8"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const config = { endpoint: "https://jamwidgets.example", siteKey: "sk-contract" };

// Enough of every response envelope for each function to finish.
const okBody = {
  success: true,
  message: "ok",
  comment_threads: [],
  comment: { id: "1" },
  reaction_counts_with_user: { pageId: "p", counts: {}, userReactions: [] },
  reaction: { reactionType: "like", count: 1 },
  posts: [],
  post: null,
  page_view_counts: { pageId: "p", views: 1, uniqueVisitors: 1 },
  record_view_response: { pageId: "p", views: 1, uniqueVisitors: 1, isNewVisitor: true },
  poll_with_results: { poll: {}, results: {}, totalVotes: 0 },
  vote_response: { success: true, results: {}, totalVotes: 0 },
  announcements: [],
  galleries: { galleries: [] },
  gallery: null,
  site_config: { name: "s", slug: "s", showPoweredBy: false },
};

interface Captured {
  method: string;
  url: URL;
  body: unknown;
}

async function capture(call: () => Promise<unknown>): Promise<Captured> {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(okBody), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetch);
  await call();
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init = {}] = fetch.mock.calls[0] as [string, RequestInit?];
  return {
    method: (init.method ?? "GET").toLowerCase(),
    url: new URL(url),
    body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
  };
}

function operationFor(request: Captured): Operation {
  const match = Object.entries(spec.paths).find(([template]) => {
    const pattern = new RegExp(`^${template.replace(/\{[^}]+\}/g, "[^/]+")}$`);
    return pattern.test(request.url.pathname);
  });
  expect(match, `no API path matches ${request.url.pathname}`).toBeDefined();
  const operation = match?.[1][request.method];
  expect(operation, `${request.method.toUpperCase()} ${match?.[0]} is not an API operation`).toBeDefined();
  return operation as Operation;
}

function resolve(schema: Schema): Schema {
  const ref = schema.$ref;
  if (typeof ref !== "string") return schema;
  return resolve(spec.components.schemas[ref.replace("#/components/schemas/", "")]);
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

/** The JSON Schema subset the generated document uses. Returns problems found. */
function validate(value: unknown, raw: Schema, at = "body"): string[] {
  const schema = resolve(raw);
  const problems: string[] = [];
  const types = schema.type === undefined ? [] : ([] as string[]).concat(schema.type as string | string[]);
  const actual = typeOf(value);
  if (types.length && !types.includes(actual) && !(actual === "integer" && types.includes("number"))) {
    return [`${at}: expected ${types.join("|")}, got ${actual} (${JSON.stringify(value)})`];
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    problems.push(`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) problems.push(`${at}: too short`);
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) problems.push(`${at}: too long`);
  }
  if (actual === "array" && schema.items) {
    (value as unknown[]).forEach((item, index) => {
      problems.push(...validate(item, schema.items as Schema, `${at}[${index}]`));
    });
  }
  if (actual === "object") {
    const object = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, Schema>;
    for (const name of (schema.required ?? []) as string[]) {
      if (object[name] === undefined) problems.push(`${at}.${name}: required`);
    }
    for (const [name, item] of Object.entries(object)) {
      if (properties[name]) {
        problems.push(...validate(item, properties[name], `${at}.${name}`));
      } else if (schema.additionalProperties === false) {
        problems.push(`${at}.${name}: not accepted by the API`);
      }
    }
  }
  return problems;
}

function expectMatchesContract(request: Captured): void {
  const operation = operationFor(request);
  const accepted = new Set((operation.parameters ?? []).filter((p) => p.in === "query").map((p) => p.name));
  for (const name of request.url.searchParams.keys()) {
    expect(accepted, `query parameter "${name}" is not accepted`).toContain(name);
  }
  const schema = operation.requestBody?.content["application/json"]?.schema;
  if (request.body === undefined) {
    expect(operation.requestBody, "the API requires a request body").toBeUndefined();
    return;
  }
  expect(schema, "the API takes no request body").toBeDefined();
  expect(validate(request.body, schema as Schema)).toEqual([]);
}

const calls: Array<[string, () => Promise<unknown>]> = [
  // A fresh key each time: site config is cached per key.
  ["fetchSiteConfig", () => core.fetchSiteConfig({ ...config, siteKey: `sk-${core.generateUUID()}` })],
  ["submitForm", () => core.submitForm({ ...config, formSlug: "contact", data: { email: "a@example.test" } })],
  ["fetchComments", () => core.fetchComments({ ...config, pageId: "/post" })],
  ["postComment", () => core.postComment({ ...config, pageId: "/post", authorName: "Ada", content: "Hi" })],
  [
    "postComment reply",
    () => core.postComment({ ...config, pageId: "/post", authorName: "Ada", content: "Hi", parentId: "42" }),
  ],
  [
    "postComment spam fields",
    () =>
      core.postComment({
        ...config,
        pageId: "/post",
        authorName: "Ada",
        content: "Hi",
        honeypot: "bot",
        formLoadTime: 1_760_000_000,
      }),
  ],
  ["fetchReactions", () => core.fetchReactions({ ...config, pageId: "/post" })],
  ["addReaction", () => core.addReaction({ ...config, pageId: "/post", reactionType: "love" })],
  ["removeReaction", () => core.removeReaction({ ...config, pageId: "/post", reactionType: "love" })],
  ["subscribe", () => core.subscribe({ ...config, email: "a@example.test" })],
  ["subscribe honeypot", () => core.subscribe({ ...config, email: "a@example.test", honeypot: "bot" })],
  ["fetchPosts", () => core.fetchPosts({ ...config, tag: "news", limit: 10 })],
  ["fetchPost", () => core.fetchPost({ ...config, slug: "hello" })],
  ["joinWaitlist", () => core.joinWaitlist({ ...config, email: "a@example.test", name: "Ada", source: "home" })],
  ["getViewCounts", () => core.getViewCounts({ ...config, pageId: "/post" })],
  ["recordView", () => core.recordView({ ...config, pageId: "/post" })],
  ...(["bug", "feature", "general"] as const).map(
    (type): [string, () => Promise<unknown>] => [
      `submitFeedback ${type}`,
      () => core.submitFeedback({ ...config, type, content: "Nice", email: "a@example.test", pageUrl: "/p" }),
    ],
  ),
  ["fetchPoll", () => core.fetchPoll({ ...config, slug: "favorite" })],
  ["votePoll", () => core.votePoll({ ...config, slug: "favorite", selectedOptions: ["alpha"] })],
  ["fetchAnnouncements", () => core.fetchAnnouncements(config)],
  ["dismissAnnouncement", () => core.dismissAnnouncement({ ...config, announcementId: 7 })],
  ["dismissAnnouncement string ID", () => core.dismissAnnouncement({ ...config, announcementId: "7" })],
];

describe.skipIf(!hasSpec)("widget API contract", () => {
  it.each(calls)("%s sends a request the API accepts", async (_name, call) => {
    expectMatchesContract(await capture(call));
  });

  it("covers every widget operation the API documents", async () => {
    const requested = new Set<string>();
    for (const [, call] of calls) {
      const request = await capture(call);
      const template = Object.keys(spec.paths).find((path) =>
        new RegExp(`^${path.replace(/\{[^}]+\}/g, "[^/]+")}$`).test(request.url.pathname),
      );
      requested.add(`${request.method} ${template}`);
    }
    // Endpoints core deliberately leaves to other callers.
    const elsewhere = new Set([
      "post /api/v1/e", // analytics beacon (beacon.ts)
      "get /api/v1/health",
      "post /api/v1/deploy/complete/{batch_id}",
      "get /api/v1/galleries",
      "get /api/v1/galleries/{slug}",
      "get /api/v1/galleries/{slug}/random",
    ]);
    const missing = Object.entries(spec.paths)
      .filter(([path]) => path.startsWith("/api/v1/") && !/subscribe\/confirm|unsubscribe/.test(path))
      .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method} ${path}`))
      .filter((operation) => !requested.has(operation) && !elsewhere.has(operation));
    expect(missing, "widget operations with no contract check").toEqual([]);
  });
});

describe.skipIf(!hasSpec)("feedback types", () => {
  it("match the API's enum exactly", () => {
    const write = resolve({ $ref: "#/components/schemas/FeedbackWrite" });
    const properties = write.properties as Record<string, Schema>;
    expect([...(properties.feedbackType.enum as string[])].sort()).toEqual(["bug", "feature", "general"]);
  });
});

describe.skipIf(!hasSpec)("poll results modes", () => {
  it("match the API's enum exactly", () => {
    // Keep in step with core's ShowResultsMode.
    const modes: core.ShowResultsMode[] = ["afterEnd", "afterVote", "always", "never"];
    const settings = resolve({ $ref: "#/components/schemas/PollSettings" });
    const properties = settings.properties as Record<string, Schema>;
    expect([...(properties.showResults.enum as string[])].sort()).toEqual(modes);
  });

  it("PollWithResults covers every field the API requires", () => {
    const poll: core.PollWithResults = {
      id: "3", slug: "s", question: "q", options: [{ id: "a", text: "A" }],
      settings: { multiSelect: false, showResults: "afterVote" }, endsAt: null, isActive: true,
      results: {}, totalVotes: 0, userVotes: null,
    };
    const schema = resolve({ $ref: "#/components/schemas/PollWithResults" });
    expect(validate(poll, schema)).toEqual([]);
    expect(Object.keys(poll).sort()).toEqual([...(schema.required as string[])].sort());
  });
});

describe("submitForm", () => {
  it("leaves the load time out instead of stamping the time of submission", async () => {
    const request = await capture(() => core.submitForm({ ...config, formSlug: "contact", data: { a: "b" } }));
    expect(request.body).not.toHaveProperty("_seriph_ts");
  });

  it("sends the load time it was given and an idempotency key", async () => {
    const request = await capture(() =>
      core.submitForm({ ...config, formSlug: "contact", data: { a: "b" }, formLoadTime: 1_700_000_000, requestId: "r1" }),
    );
    expect(request.body).toMatchObject({ _seriph_ts: 1_700_000_000, _seriph_id: "r1" });
  });

  it("FormController reuses the key while retrying the same data, and rotates it after success", async () => {
    const ids: unknown[] = [];
    const fetch = vi
      .fn()
      .mockImplementationOnce(async () => new Response("{}", { status: 503 }))
      .mockImplementation(async () => new Response(JSON.stringify({ success: true, message: "ok" })));
    vi.stubGlobal("fetch", fetch);
    const form = new core.FormController(config, "contact");
    await form.submit({ a: "b" }).catch(() => undefined);
    await form.submit({ a: "b" });
    await form.submit({ a: "b" });
    for (const [, init] of fetch.mock.calls as Array<[string, RequestInit]>) {
      ids.push(JSON.parse(String(init.body))._seriph_id);
    }
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[1]);
  });
});

describe("FormController overlapping submits", () => {
  it("keeps a newer submission's retry key when an older one succeeds", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    let releaseFirst: () => void = () => undefined;
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      if (body.a === "first") await new Promise<void>((resolve) => (releaseFirst = resolve));
      if (body.a === "second" && bodies.filter((b) => b.a === "second").length === 1) {
        return new Response("{}", { status: 503 });
      }
      return new Response(JSON.stringify({ success: true, message: "ok" }));
    });
    vi.stubGlobal("fetch", fetch);
    const form = new core.FormController(config, "contact");
    const first = form.submit({ a: "first" });
    await form.submit({ a: "second" }).catch(() => undefined);
    releaseFirst();
    await first;
    await form.submit({ a: "second" });
    const seconds = bodies.filter((b) => b.a === "second");
    expect(seconds[1]._seriph_id).toBe(seconds[0]._seriph_id);
  });
});

describe("FormController errors", () => {
  it("reports data that cannot be sent instead of staying in loading", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const form = new core.FormController(config, "contact");
    await expect(form.submit({ count: 1n })).rejects.toThrow();
    expect(form.getState().status).toBe("error");
  });
});

describe("postComment", () => {
  it("rejects a parent ID that is not a comment ID before sending", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      core.postComment({ ...config, pageId: "/p", authorName: "A", content: "B", parentId: "abc" }),
    ).rejects.toThrow(/parentId/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the honeypot and the form's load time", async () => {
    const request = await capture(() =>
      core.postComment({
        ...config,
        pageId: "/p",
        authorName: "A",
        content: "B",
        parentId: "42",
        honeypot: "bot",
        formLoadTime: 1_760_000_000,
      }),
    );
    expect(request.body).toMatchObject({ parentId: 42, _gotcha: "bot", _seriph_ts: 1_760_000_000 });
  });
});

describe("subscribe", () => {
  it("sends the honeypot only when it is filled in", async () => {
    expect((await capture(() => core.subscribe({ ...config, email: "a@example.test", honeypot: "bot" }))).body).toEqual({
      email: "a@example.test",
      _gotcha: "bot",
    });
    expect((await capture(() => core.subscribe({ ...config, email: "a@example.test", honeypot: "" }))).body).toEqual({
      email: "a@example.test",
    });
  });
});

describe("API errors", () => {
  it("surface the server's message and code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "Unprocessable Entity", message: "Email is invalid", code: "validation" }), {
          status: 422,
          statusText: "",
        }),
      ),
    );
    const error = await core.subscribe({ ...config, email: "nope" }).catch((e) => e);
    expect(error).toBeInstanceOf(core.JamwidgetsApiError);
    expect(error).toMatchObject({ message: "Email is invalid", status: 422, code: "validation" });
  });

  it("fall back to the action and status when the body has no message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 })));
    await expect(core.subscribe({ ...config, email: "a@example.test" })).rejects.toThrow("Subscription failed (HTTP 502)");
  });
});

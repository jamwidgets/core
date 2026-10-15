// Shared fixtures for the widget parity tests. Astro, React and Solid each
// drive every widget through their own layer against these same responses, so
// a widget behaves the same whichever framework renders it.
import { expect, vi } from "vitest";

export const CONFIG = { siteKey: "sk-parity", endpoint: "https://jamwidgets.test" };

/** The message the error-path response carries; every layer must surface it. */
export const SERVER_ERROR = "Rejected by the parity test server";

export type Widget =
  | "subscribe"
  | "form"
  | "waitlist"
  | "feedback"
  | "comments"
  | "reactions"
  | "views"
  | "poll"
  | "announcements";

export interface WidgetCase {
  widget: Widget;
  /** Request the widget's first call must make, relative to /api/v1 */
  method: "GET" | "POST";
  path: string;
  /** Successful response body */
  body: unknown;
}

export const PAGE = "/blog/hello";
export const POLL = {
  id: "7",
  slug: "favorite",
  question: "Favorite?",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
  settings: { multiSelect: false, showResults: "always" },
  isActive: true,
  endsAt: null,
  results: { a: 2, b: 1 },
  totalVotes: 3,
  userVotes: null,
};

export const WIDGET_CASES: WidgetCase[] = [
  { widget: "subscribe", method: "POST", path: "/subscribe", body: { success: true, message: "Check your inbox" } },
  { widget: "form", method: "POST", path: "/forms/contact/submit", body: { success: true, message: "Thanks!" } },
  { widget: "waitlist", method: "POST", path: "/waitlist", body: { success: true, message: "You're on the list!", position: 4 } },
  { widget: "feedback", method: "POST", path: "/feedback", body: { success: true, message: "Thanks for the feedback" } },
  {
    widget: "comments",
    method: "GET",
    path: `/comments/${encodeURIComponent(PAGE)}`,
    body: { comment_threads: [{ id: "1", authorName: "Ada", content: "Hi", createdAt: "2026-10-01T00:00:00Z", replies: [] }] },
  },
  {
    widget: "reactions",
    method: "GET",
    path: `/reactions/${encodeURIComponent(PAGE)}`,
    body: { reaction_counts_with_user: { pageId: PAGE, counts: { like: 3 }, userReactions: ["like"] } },
  },
  {
    widget: "views",
    method: "POST",
    path: `/views/${encodeURIComponent(PAGE)}`,
    body: { record_view_response: { pageId: PAGE, views: 12, uniqueVisitors: 9 } },
  },
  { widget: "poll", method: "GET", path: `/polls/${POLL.slug}`, body: { poll_with_results: POLL } },
  {
    widget: "announcements",
    method: "GET",
    path: "/announcements",
    body: { announcements: [{ id: "3", content: "Hello", announcementType: "info", isDismissible: true }] },
  },
];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Stub fetch with the widget's success response, or a 422 carrying SERVER_ERROR. */
export function stubApi(testCase: WidgetCase, ok: boolean) {
  const fetch = vi.fn(async () =>
    ok ? json(200, testCase.body) : json(422, { status: "Unprocessable Entity", message: SERVER_ERROR, code: "validation" }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

/** The widget's first request went to the case's method and path. */
export function expectRequest(fetch: ReturnType<typeof stubApi>, testCase: WidgetCase) {
  expect(fetch).toHaveBeenCalled();
  const [url, init] = fetch.mock.calls[0] as unknown as [string | URL, RequestInit | undefined];
  expect(new URL(String(url)).pathname).toBe(`/api/v1${testCase.path}`);
  expect((init?.method ?? "GET").toUpperCase()).toBe(testCase.method);
}

/** Wait for an async widget state to settle. */
export async function settle(done: () => boolean) {
  await vi.waitFor(() => {
    if (!done()) throw new Error("widget state has not settled");
  });
}

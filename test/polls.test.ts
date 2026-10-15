import { afterEach, describe, expect, it, vi } from "vitest";

import { describePoll, PollController, type PollWithResults, votePoll } from "../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const config = { endpoint: "https://jamwidgets.example", siteKey: "sk-acme" };

function poll(overrides: Partial<PollWithResults> = {}): PollWithResults {
  return {
    id: "3",
    slug: "favorite",
    question: "Favorite?",
    options: [{ id: "alpha", text: "Alpha" }, { id: "beta", text: "Beta" }],
    settings: { multiSelect: false, showResults: "afterVote" },
    endsAt: null,
    isActive: true,
    results: {},
    totalVotes: 0,
    userVotes: null,
    ...overrides,
  };
}

function respond(...bodies: Array<{ status?: number; body: unknown }>) {
  const fetch = vi.fn();
  for (const { status = 200, body } of bodies) {
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
    );
  }
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("votePoll", () => {
  it("sends the camel-case request shape accepted by the widget API", async () => {
    const fetch = respond({ body: { vote_response: { success: true, results: { alpha: 1 }, totalVotes: 1 } } });

    await votePoll({ ...config, slug: "favorite", selectedOptions: ["alpha"] });

    expect(fetch).toHaveBeenCalledWith(
      "https://jamwidgets.example/api/v1/polls/favorite/vote",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ selectedOptions: ["alpha"] }),
      }),
    );
  });

  it("escapes the slug like fetchPoll does", async () => {
    const fetch = respond({ body: { vote_response: { success: true, results: {}, totalVotes: 0 } } });

    await votePoll({ ...config, slug: "a/b", selectedOptions: ["alpha"] });

    expect(fetch.mock.calls[0][0]).toBe("https://jamwidgets.example/api/v1/polls/a%2Fb/vote");
  });
});

describe("describePoll", () => {
  const now = new Date("2026-10-15T12:00:00Z");

  it("lets a visitor vote on an open poll they haven't voted on", () => {
    expect(describePoll(poll(), now)).toEqual({
      hasVoted: false, isEnded: false, canVote: true, showResults: false, status: "",
    });
  });

  it("reports voted, closed and ended polls", () => {
    expect(describePoll(poll({ userVotes: ["alpha"], results: { alpha: 1 }, totalVotes: 1 }), now))
      .toMatchObject({ canVote: false, showResults: true, status: "Voted" });
    expect(describePoll(poll({ isActive: false }), now)).toMatchObject({ canVote: false, status: "Closed" });
    expect(describePoll(poll({ endsAt: "2026-10-14T00:00:00Z" }), now))
      .toMatchObject({ canVote: false, isEnded: true, status: "Ended" });
  });
});

describe("PollController", () => {
  it("shows counts after voting when the poll allows it", async () => {
    respond(
      { body: { poll_with_results: poll() } },
      { body: { vote_response: { success: true, results: { alpha: 2 }, totalVotes: 2 } } },
    );
    const controller = new PollController(config, "favorite");
    await controller.fetch();
    await controller.vote(["alpha"]);

    const state = controller.getState().poll!;
    expect(state.results).toEqual({ alpha: 2 });
    expect(state.totalVotes).toBe(2);
    expect(state.userVotes).toEqual(["alpha"]);
  });

  it("never reveals counts the owner hid, even if the server sends them", async () => {
    respond(
      { body: { poll_with_results: poll({ settings: { multiSelect: false, showResults: "never" } }) } },
      { body: { vote_response: { success: true, results: { alpha: 2 }, totalVotes: 2 } } },
    );
    const controller = new PollController(config, "favorite");
    await controller.fetch();
    await controller.vote(["alpha"]);

    const state = controller.getState().poll!;
    expect(state.results).toEqual({});
    expect(state.totalVotes).toBe(0);
    expect(describePoll(state)).toMatchObject({ hasVoted: true, showResults: false, status: "Voted" });
  });

  it("names its widget when the poll is missing", async () => {
    respond({ status: 404, body: { status: "Not Found", message: "Poll not found", code: "not_found" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const controller = new PollController(config, "gone", "Embedded poll");

    expect(await controller.fetch()).toBeNull();
    expect(controller.getState().status).toBe("notFound");
    expect(warn.mock.calls[0]?.join(" ")).toContain("Embedded poll");
  });

  it("keeps the server's message when a vote fails", async () => {
    respond(
      { body: { poll_with_results: poll() } },
      { status: 400, body: { status: "Bad Request", message: "Poll is closed", code: "bad_request" } },
    );
    const controller = new PollController(config, "favorite");
    await controller.fetch();

    await expect(controller.vote(["alpha"])).rejects.toThrow("Poll is closed");
    expect(controller.getState().poll!.userVotes).toBeNull();
  });
});

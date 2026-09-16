import { afterEach, describe, expect, it, vi } from "vitest";

import { votePoll } from "../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("votePoll", () => {
  it("sends the camel-case request shape accepted by the widget API", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          vote_response: { success: true, results: { alpha: 1 }, totalVotes: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);

    await votePoll({
      endpoint: "https://jamwidgets.example",
      siteKey: "sk-acme",
      slug: "favorite",
      selectedOptions: ["alpha"],
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://jamwidgets.example/api/v1/polls/favorite/vote",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ selectedOptions: ["alpha"] }),
      }),
    );
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST } from "../app/api/extract/route";

const originalApiKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
});

afterAll(() => {
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("no-key extraction route", () => {
  it("returns a local structured extraction for pasted text", async () => {
    const response = await POST(
      jsonRequest({
        text: "Man Mo Temple must visit\nVictoria Peak near sunset\nStar Ferry if time",
        imageDataUrl: null,
        sourceKind: "plain_text",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toMatchObject({
      ok: true,
      mode: "local_rules",
      isLiveAnalysis: false,
      screenshotRead: false,
    });
    expect(body.extraction.places).toHaveLength(3);
  });

  it("asks for pasted text for screenshot-only input", async () => {
    const response = await POST(
      jsonRequest({
        text: null,
        imageDataUrl: "data:image/png;base64,AAAA",
        sourceKind: "screenshot",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("LOCAL_TEXT_REQUIRED");
    expect(body.error.message).toMatch(/paste the visible text/i);
    expect(body.error.message).not.toMatch(/OPENAI_API_KEY/i);
  });

  it("still rejects malformed JSON before selecting an extractor", async () => {
    const response = await POST(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not valid json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_JSON" },
    });
  });
});

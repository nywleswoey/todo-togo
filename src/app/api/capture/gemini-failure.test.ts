import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { makeTestDb, resetDb } from "../../../../test/db";
import { listOpen } from "@/lib/todos";
import { getDb } from "@/lib/db";
import { uploadCapture } from "@/lib/api";
import { POST } from "./route";

/**
 * The Gemini seam is NOT mocked here — the real @google/genai client runs
 * against a stubbed Google endpoint, so these tests cover the actual wire call
 * (which model, which config) and what an operator sees when it fails.
 *
 * The production incident this reproduces: a 429 RESOURCE_EXHAUSTED from
 * Gemini surfaced as an empty-bodied 502 in the Vercel logs and a bare
 * "capture_failed" in PostHog.
 */

const GOOGLE = "generativelanguage.googleapis.com";

/** The exact error body Google returns when the free-tier quota is zeroed. */
const QUOTA_429 = {
  error: {
    code: 429,
    message:
      "You exceeded your current quota, please check your plan and billing details. " +
      "quota_metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, " +
      "quota_id: GenerateRequestsPerDayPerProjectPerModel-FreeTier, limit: 0",
    status: "RESOURCE_EXHAUSTED",
  },
};

/** A well-formed model reply in the INTENT_SCHEMA shape. */
const MODEL_OK = {
  candidates: [
    {
      content: {
        role: "model",
        parts: [
          {
            text: JSON.stringify({
              intent: "capture",
              transcript: "buy milk tomorrow",
              captures: [{ title: "buy milk", due_date: "2026-07-27" }],
            }),
          },
        ],
      },
      finishReason: "STOP",
    },
  ],
};

interface SeenCall {
  url: string;
  body: Record<string, unknown>;
}

const seen: SeenCall[] = [];

/**
 * Stand in for both network hops the voice path makes: the browser's POST to
 * /api/capture (routed straight into the route handler) and the server's call
 * out to Google.
 */
function stubFetch(google: { status: number; body: unknown }) {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes(GOOGLE)) {
        seen.push({
          url,
          body: JSON.parse(String(init?.body ?? "{}")),
        });
        return new Response(JSON.stringify(google.body), {
          status: google.status,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.includes("/api/capture")) {
        return POST(
          new Request("http://test/api/capture", {
            method: "POST",
            body: init?.body as BodyInit,
          }),
        );
      }

      throw new Error(`unexpected fetch: ${url}`);
    },
  );
}

function clip(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
}

beforeEach(async () => {
  await makeTestDb();
  seen.length = 0;
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  resetDb();
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

test("the voice path calls gemini-2.5-flash with thinking disabled", async () => {
  stubFetch({ status: 200, body: MODEL_OK });

  const result = await uploadCapture(clip());

  // The model string that actually goes on the wire.
  expect(seen).toHaveLength(1);
  expect(seen[0].url).toContain("models/gemini-2.5-flash:generateContent");
  const cfg = seen[0].body.generationConfig as Record<string, unknown>;
  expect(cfg.thinkingConfig).toEqual({ thinkingBudget: 0 });
  expect(cfg.responseMimeType).toBe("application/json");
  expect(cfg.responseSchema).toBeTruthy();

  // …and the capture still lands end-to-end on the new model.
  expect(result.intent).toBe("capture");
  expect((await listOpen(getDb())).map((t) => t.title)).toEqual(["buy milk"]);
});

test("a 429 quota error is logged server-side and carried into the client exception", async () => {
  stubFetch({ status: 429, body: QUOTA_429 });
  const logged = vi.spyOn(console, "error");

  await expect(uploadCapture(clip())).rejects.toThrow(/capture_failed \(502\)/);

  // Server side: the real Gemini error reaches the Vercel function logs.
  expect(logged).toHaveBeenCalledOnce();
  const [prefix, err] = logged.mock.calls[0];
  expect(prefix).toBe("[capture] interpretAudio failed:");
  expect(String((err as Error).message)).toMatch(/RESOURCE_EXHAUSTED/);

  // Client side: the message PostHog captures names the quota failure instead
  // of a bare "capture_failed".
  const clientError = await uploadCapture(clip()).catch((e: unknown) => e);
  expect(clientError).toBeInstanceOf(Error);
  const clientMessage = (clientError as Error).message;
  // CAPTURE_ERROR_LOG=1 prints the exact message PostHog would capture.
  if (process.env.CAPTURE_ERROR_LOG) {
    console.log("posthog.captureException message:", clientMessage);
  }
  expect(clientMessage).toMatch(/RESOURCE_EXHAUSTED/);
  expect(clientMessage).toMatch(/limit: 0/);

  // A failed transcription still writes nothing.
  expect(await listOpen(getDb())).toEqual([]);

  logged.mockRestore();
});

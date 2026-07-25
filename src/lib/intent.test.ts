import { expect, test } from "vitest";
import { parseIntent } from "./intent";

test("parses a multi-capture result", () => {
  const r = parseIntent({
    intent: "capture",
    transcript: "buy milk and call the dentist tomorrow",
    captures: [
      { title: "buy milk", due_date: null },
      { title: "call the dentist", due_date: "2026-07-26" },
    ],
  });
  expect(r.intent).toBe("capture");
  expect(r.captures).toHaveLength(2);
  expect(r.captures[1].due_date).toBe("2026-07-26");
});

test("drops empty-title captures and downgrades to unknown if none remain", () => {
  const r = parseIntent({
    intent: "capture",
    transcript: "uhh",
    captures: [{ title: "   ", due_date: null }],
  });
  expect(r.intent).toBe("unknown");
  expect(r.transcript).toBe("uhh");
});

test("invalid due_date is coerced to null", () => {
  const r = parseIntent({
    intent: "capture",
    transcript: "x",
    captures: [{ title: "thing", due_date: "next friday" }],
  });
  expect(r.captures[0].due_date).toBeNull();
});

test("parses a command with candidates capped at 3", () => {
  const r = parseIntent({
    intent: "command",
    transcript: "mark the milk one done",
    command: {
      action: "complete",
      target_phrase: "the milk one",
      candidates: [
        { id: "a", title: "A", confidence: "high" },
        { id: "b", title: "B", confidence: "low" },
        { id: "c", title: "C", confidence: "low" },
        { id: "d", title: "D", confidence: "low" },
      ],
    },
  });
  expect(r.intent).toBe("command");
  expect(r.command?.candidates).toHaveLength(3);
  expect(r.command?.candidates[0].confidence).toBe("high");
});

test("command with empty candidates stays a command (explicit no-match)", () => {
  const r = parseIntent({
    intent: "command",
    transcript: "finish the thing",
    command: { action: "complete", target_phrase: "the thing", candidates: [] },
  });
  expect(r.intent).toBe("command");
  expect(r.command?.candidates).toEqual([]);
});

test("unknown intent still preserves the transcript", () => {
  const r = parseIntent({ intent: "unknown", transcript: "mumble" });
  expect(r.intent).toBe("unknown");
  expect(r.transcript).toBe("mumble");
});

test("malformed JSON string degrades to unknown", () => {
  expect(parseIntent("{ not json").intent).toBe("unknown");
});

test("accepts a JSON string payload", () => {
  const r = parseIntent(
    JSON.stringify({ intent: "capture", transcript: "t", captures: [{ title: "go" }] }),
  );
  expect(r.captures[0].title).toBe("go");
});

import { expect, test } from "vitest";
import { pickRecordingMimeType } from "./recorder";

test("prefers webm/opus when supported (Chrome/Android)", () => {
  const supported = new Set(["audio/webm;codecs=opus", "audio/webm"]);
  expect(pickRecordingMimeType((t) => supported.has(t))).toBe(
    "audio/webm;codecs=opus",
  );
});

test("falls back to mp4/AAC on iOS Safari (no webm support)", () => {
  const supported = new Set(["audio/mp4", "audio/aac"]);
  expect(pickRecordingMimeType((t) => supported.has(t))).toBe("audio/mp4");
});

test("returns empty string to let the browser choose when nothing matches", () => {
  expect(pickRecordingMimeType(() => false)).toBe("");
});

import { expect, test } from "vitest";
import { decideCompletionUi } from "./completion";
import type { Candidate } from "./intent";

const c = (id: string, confidence: "high" | "low"): Candidate => ({
  id,
  title: id,
  confidence,
});

test("no candidates → no sheet (caller warns 'couldn't find that')", () => {
  expect(decideCompletionUi([])).toEqual({ kind: "none" });
});

test("exactly one high-confidence match → confirm sheet", () => {
  const d = decideCompletionUi([c("a", "high")]);
  expect(d.kind).toBe("confirm");
  expect(d).toMatchObject({ candidate: { id: "a" } });
});

test("a single low-confidence match → tap-list (not an auto-confirm)", () => {
  expect(decideCompletionUi([c("a", "low")]).kind).toBe("list");
});

test("more than one match → tap-list even when all high", () => {
  expect(decideCompletionUi([c("a", "high"), c("b", "high")]).kind).toBe("list");
});

test("mixed confidences → tap-list", () => {
  expect(decideCompletionUi([c("a", "high"), c("b", "low")]).kind).toBe("list");
});

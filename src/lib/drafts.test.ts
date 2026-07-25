import { expect, test } from "vitest";
import {
  draftReducer,
  initialDraftState,
  isDraft,
  type DraftState,
} from "./drafts";

function apply(state: DraftState, ...events: Parameters<typeof draftReducer>[1][]) {
  return events.reduce(draftReducer, state);
}

test("captured todos become pending drafts, newest first", () => {
  const s = apply(initialDraftState, { type: "captured", ids: ["a", "b"] });
  expect(s.pendingIds).toEqual(["a", "b"]);
  const s2 = draftReducer(s, { type: "captured", ids: ["c"] });
  expect(s2.pendingIds).toEqual(["c", "a", "b"]);
});

test("one draft per capture — duplicate ids are ignored", () => {
  const s = apply(
    initialDraftState,
    { type: "captured", ids: ["a"] },
    { type: "captured", ids: ["a"] },
  );
  expect(s.pendingIds).toEqual(["a"]);
});

test("confirm (Keep / self-confirm) settles a single draft", () => {
  const s = apply(
    initialDraftState,
    { type: "captured", ids: ["a", "b"] },
    { type: "confirm", id: "a" },
  );
  expect(s.pendingIds).toEqual(["b"]);
  expect(isDraft(s, "a")).toBe(false);
  expect(isDraft(s, "b")).toBe(true);
});

test("discard removes a draft", () => {
  const s = apply(
    initialDraftState,
    { type: "captured", ids: ["a", "b"] },
    { type: "discard", id: "a" },
  );
  expect(s.pendingIds).toEqual(["b"]);
});

test("settleAll (background) confirms every pending draft at once", () => {
  const s = apply(
    initialDraftState,
    { type: "captured", ids: ["a", "b", "c"] },
    { type: "settleAll" },
  );
  expect(s.pendingIds).toEqual([]);
});

test("acting on an unknown id is a no-op (stable reference)", () => {
  const s = apply(initialDraftState, { type: "captured", ids: ["a"] });
  expect(draftReducer(s, { type: "confirm", id: "zzz" })).toBe(s);
});

import { expect, test } from "vitest";
import { buildPrompt } from "./prompt";

test("prompt injects today, timezone, and open todos with ids", () => {
  const p = buildPrompt({
    today: "2026-07-25",
    timezone: "America/New_York",
    openTodos: [
      { id: "11111111-1111-1111-1111-111111111111", title: "Buy milk" },
      { id: "22222222-2222-2222-2222-222222222222", title: "Call dentist" },
    ],
  });
  expect(p).toContain("2026-07-25");
  expect(p).toContain("America/New_York");
  expect(p).toContain("id=11111111-1111-1111-1111-111111111111 :: Buy milk");
  expect(p).toContain("Call dentist");
});

test("prompt handles an empty open-todo list", () => {
  const p = buildPrompt({
    today: "2026-07-25",
    timezone: "UTC",
    openTodos: [],
  });
  expect(p).toContain("(no open todos)");
});

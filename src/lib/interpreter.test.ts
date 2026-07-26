import { afterEach, expect, test } from "vitest";
import { getInterpreter } from "./interpreter";
import { geminiInterpreter } from "./interpreters/gemini";

afterEach(() => {
  delete process.env.CAPTURE_PROVIDER;
});

test("defaults to the Gemini backend when CAPTURE_PROVIDER is unset", () => {
  expect(getInterpreter()).toBe(geminiInterpreter);
});

test("selects the backend named by CAPTURE_PROVIDER", () => {
  process.env.CAPTURE_PROVIDER = "gemini";
  expect(getInterpreter()).toBe(geminiInterpreter);
});

test("an unknown provider fails loudly, naming the known set", () => {
  process.env.CAPTURE_PROVIDER = "whisper";
  expect(() => getInterpreter()).toThrow(/Unknown CAPTURE_PROVIDER "whisper"/);
  expect(() => getInterpreter()).toThrow(/gemini/);
});

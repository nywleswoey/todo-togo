import "server-only";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { config } from "../config";
import { buildPrompt } from "../prompt";
import { parseIntent } from "../intent";
import type { AudioInterpreter, InterpretInput } from "../interpreter";

/**
 * The Gemini implementation of AudioInterpreter: audio in, transcript +
 * interpreted intent out, in a single multimodal call.
 */

const INTENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ["capture", "command", "unknown"] },
    transcript: { type: Type.STRING },
    captures: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          due_date: { type: Type.STRING, nullable: true },
        },
        required: ["title"],
      },
    },
    command: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        action: { type: Type.STRING, enum: ["complete"] },
        target_phrase: { type: Type.STRING },
        candidates: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ["high", "low"] },
            },
            required: ["id", "title", "confidence"],
          },
        },
      },
      required: ["action", "candidates"],
    },
  },
  required: ["intent", "transcript"],
};

/** The levels an operator may ask for — UNSPECIFIED is a placeholder, not a setting. */
const THINKING_LEVELS = Object.values(ThinkingLevel).filter(
  (level) => level !== ThinkingLevel.THINKING_LEVEL_UNSPECIFIED,
);

/**
 * GEMINI_THINKING_LEVEL, resolved against the SDK enum so a typo fails here
 * naming the accepted values instead of as an opaque 400 from Google.
 */
function thinkingLevel(): ThinkingLevel {
  const raw = config.geminiThinkingLevel;
  const level = THINKING_LEVELS.find((l) => l === raw.toUpperCase());
  if (!level) {
    throw new Error(
      `Invalid GEMINI_THINKING_LEVEL: ${raw} (expected one of ${THINKING_LEVELS.join(", ")})`,
    );
  }
  return level;
}

export const geminiInterpreter: AudioInterpreter = {
  async interpret(input: InterpretInput) {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    const response = await ai.models.generateContent({
      // Defaults to the floating alias gemini-flash-lite-latest — multimodal
      // (audio in) with the roomiest free-tier daily quota available (500 req/day
      // vs ~20 for gemini-2.5-flash); set GEMINI_MODEL to a concrete Flash-Lite
      // version to pin it when a silent alias rotation would be worse than falling
      // behind. See .env.example for what a 429 RESOURCE_EXHAUSTED here means.
      model: config.geminiModel,
      contents: [
        {
          role: "user",
          parts: [
            { text: buildPrompt(input.ctx) },
            { inlineData: { mimeType: input.mimeType, data: input.audioBase64 } },
          ],
        },
      ],
      config: {
        // Flash-Lite is a thinking model and the alias now points at a version
        // that *requires* thinking: `thinkingBudget: 0` is rejected outright with
        // a 400 INVALID_ARGUMENT. The floor, MINIMAL, is what keeps the voice path
        // snappy instead; GEMINI_THINKING_LEVEL raises it for a pinned model whose
        // supported levels start at low.
        thinkingConfig: { thinkingLevel: thinkingLevel() },
        responseMimeType: "application/json",
        responseSchema: INTENT_SCHEMA,
      },
    });
    return parseIntent(response.text ?? "");
  },
};

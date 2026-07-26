import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { config } from "./config";
import { buildPrompt, type PromptContext } from "./prompt";
import { parseIntent, type IntentResult } from "./intent";

/**
 * The Gemini Flash seam: audio in, transcript + interpreted intent out, in a
 * single call. Tests mock this module — everything above it (the capture route,
 * the apply logic) is exercised without a live model.
 */

export interface InterpretInput {
  audioBase64: string;
  mimeType: string;
  ctx: PromptContext;
}

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

export async function interpretAudio(
  input: InterpretInput,
): Promise<IntentResult> {
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const response = await ai.models.generateContent({
    // Defaults to the floating alias gemini-flash-lite-latest — multimodal
    // (audio in) with the roomiest free-tier daily quota available (500 req/day
    // vs ~20 for gemini-2.5-flash); set GEMINI_MODEL to a concrete Flash-Lite
    // version to pin it when a silent alias rotation would be worse than falling
    // behind. See .env.example for what a 429 RESOURCE_EXHAUSTED here means.
    // Flash-Lite is a thinking model, so thinking is disabled below to keep the
    // voice path snappy.
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
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: INTENT_SCHEMA,
    },
  });
  return parseIntent(response.text ?? "");
}

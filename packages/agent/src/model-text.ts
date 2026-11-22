import type { LanguageModel, ModelMessage } from "ai";

import { streamText } from "ai";

import { cancelled } from "./run-query.ts";

export async function* modelText(
  model: LanguageModel,
  system: string,
  messages: ModelMessage[],
  signal: AbortSignal
): AsyncGenerator<string> {
  const result = streamText({ abortSignal: signal, messages, model, system });
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      yield part.text;
    } else if (part.type === "error") {
      throw part.error;
    } else if (part.type === "abort") {
      throw cancelled();
    }
  }
}

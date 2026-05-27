// Pure Anthropic-client logic with no Next.js coupling. Importing this from
// a Client Component would technically work but you shouldn't — always go
// through `./client` so the `server-only` guard is in force. The only legit
// consumer of this module is the tsx smoke script.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { costUsd, type ModelId } from "./models";

export class AIServiceUnavailable extends Error {
  constructor(message = "AI service unavailable") {
    super(message);
    this.name = "AIServiceUnavailable";
  }
}

export class AIBadOutput extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = "AIBadOutput";
  }
}

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AIServiceUnavailable("ANTHROPIC_API_KEY not set");
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type CompleteResult<T> = {
  data: T;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  raw: string;
};

type CompleteArgs<T> = {
  model: ModelId;
  system: string;
  user: string;
  outputSchema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
};

// Single-shot structured completion. Wraps a model call, parses the JSON-only
// response against a Zod schema, throws AIBadOutput if it doesn't match.
// Returns the parsed value plus token usage so callers can write ai_usage_log.
export async function complete<T>(args: CompleteArgs<T>): Promise<CompleteResult<T>> {
  const client = getClient();

  const res = await client.messages.create({
    model: args.model,
    max_tokens: args.maxTokens ?? 1024,
    temperature: args.temperature ?? 0,
    system:
      args.system +
      "\n\nReturn ONLY valid JSON matching the requested schema. No prose, no markdown, no code fences.",
    messages: [{ role: "user", content: args.user }],
  });

  const raw = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  // Strip stray code fences in case the model adds them despite the system msg.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AIBadOutput("AI response was not valid JSON", raw);
  }

  const result = args.outputSchema.safeParse(parsed);
  if (!result.success) {
    throw new AIBadOutput(
      `AI response did not match schema: ${result.error.message}`,
      raw,
    );
  }

  return {
    data: result.data,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    costUsd: costUsd(args.model, res.usage.input_tokens, res.usage.output_tokens),
    raw,
  };
}

type ChatTurn = { role: "user" | "assistant"; content: string };

type ChatArgs = {
  model: ModelId;
  system: string;
  turns: ChatTurn[];
  maxTokens?: number;
  temperature?: number;
};

// Plain chat completion (no JSON enforcement) — used by the clarify step where
// the model is asking the admin questions in natural language.
export async function chat(args: ChatArgs): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}> {
  const client = getClient();

  const res = await client.messages.create({
    model: args.model,
    max_tokens: args.maxTokens ?? 512,
    temperature: args.temperature ?? 0.2,
    system: args.system,
    messages: args.turns.map((t) => ({ role: t.role, content: t.content })),
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return {
    text,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    costUsd: costUsd(args.model, res.usage.input_tokens, res.usage.output_tokens),
  };
}

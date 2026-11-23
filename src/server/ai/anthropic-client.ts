import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { StopReason, TextBlock } from "@anthropic-ai/sdk/resources/messages/messages";
import type { z } from "zod";
import type { AllowedImageMime } from "@/server/images/validate-upload";

/**
 * The one place the app calls the Anthropic SDK for image prompts. Feature code
 * (and its tests) depend on this small interface, not on the SDK.
 */
export type ImageMessageRequest = {
  model: string;
  /** Operator instructions. Untrusted content never goes here. */
  system: string;
  /** The photo, sent inline as base64 (never as a URL the API would fetch). */
  image: { mediaType: AllowedImageMime; base64: string };
  /** The user-turn text that accompanies the image. */
  instruction: string;
  /** The reply's JSON shape, sent to Claude as a structured-output format. */
  outputSchema: z.ZodType;
  signal?: AbortSignal;
};

export type ImageMessageResult = {
  stopReason: StopReason | null;
  /** The concatenated text blocks of the reply. */
  text: string;
};

/**
 * Upper bound for the reply, including Claude's thinking (always on for Opus 5.5).
 * The skill's non-streaming default; a cut-off reply would fail validation.
 */
const MAX_TOKENS = 16_000;

let client: Anthropic | undefined;

/**
 * Creates the SDK client on first use, so importing this module never needs a
 * key. The key is read from ANTHROPIC_API_KEY on the server only (no
 * NEXT_PUBLIC_ variant, never sent to the browser).
 *
 * Throws a configuration error when the variable is unset or blank, before any
 * client exists, so the SDK can't fall back to other credentials
 * (ANTHROPIC_AUTH_TOKEN, a local `ant auth login` profile). The message names
 * the variable only, never a key or token value.
 */
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Claude is not configured: ANTHROPIC_API_KEY is not set.");
  }
  client ??= new Anthropic({ apiKey });
  return client;
}

/**
 * Sends one image plus an instruction to Claude and returns the reply's text.
 *
 * - The image goes first, inline as base64, then the instruction text.
 * - `effort: "low"` keeps latency down; thinking is left at the model default
 *   (it can't be disabled on Opus 5.5). No refusal fallback model is used.
 * - `outputSchema` becomes a structured-output format. The caller still
 *   validates the returned text itself.
 * - A refusal is returned as `stopReason: "refusal"`, not thrown. SDK errors
 *   (network, rate limit, abort) propagate unchanged.
 */
export async function sendImageMessage(request: ImageMessageRequest): Promise<ImageMessageResult> {
  const message = await getClient().messages.create(
    {
      model: request.model,
      max_tokens: MAX_TOKENS,
      system: request.system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: request.image.mediaType, data: request.image.base64 },
            },
            { type: "text", text: request.instruction },
          ],
        },
      ],
      output_config: { effort: "low", format: zodOutputFormat(request.outputSchema) },
    },
    { signal: request.signal },
  );

  const text = message.content
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  return { stopReason: message.stop_reason, text };
}

import "server-only";
import type { StopReason } from "@anthropic-ai/sdk/resources/messages/messages";
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
  outputSchema?: z.ZodType;
  signal?: AbortSignal;
};

export type ImageMessageResult = {
  stopReason: StopReason | null;
  /** The concatenated text blocks of the reply. */
  text: string;
};

/**
 * RED placeholder (US-2 cycle 3): not implemented yet. Tests mock this module.
 */
export async function sendImageMessage(request: ImageMessageRequest): Promise<ImageMessageResult> {
  void request;
  return { stopReason: null, text: "" };
}

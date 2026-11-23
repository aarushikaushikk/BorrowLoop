import { beforeEach, describe, expect, it, vi } from "vitest";
import { ItemCategory, ItemCondition } from "@/generated/prisma/enums";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/validation/listing";
import type { ImageMessageRequest, ImageMessageResult } from "./anthropic-client";

const { sendImageMessageMock } = vi.hoisted(() => ({
  sendImageMessageMock: vi.fn<(request: ImageMessageRequest) => Promise<ImageMessageResult>>(),
}));

vi.mock("server-only", () => ({}));
// Mock our own wrapper, never the SDK: unit tests must not reach the real API.
vi.mock("./anthropic-client", () => ({ sendImageMessage: sendImageMessageMock }));
vi.mock("./config", () => ({ getListingSuggestionModel: () => "test-listing-model" }));

import { suggestListing } from "./listing-suggestion";

// US-2 AC: for a valid image, Claude suggests title, category, condition and
// description. Category and condition come from the Prisma enums.

const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const PHOTO = { bytes: PNG_BYTES, mime: "image/png" as const };

const VALID_REPLY = {
  title: "Cordless drill",
  description: "18V cordless drill with two batteries and a charger.",
  category: ItemCategory.TOOLS,
  condition: ItemCondition.GOOD,
  prohibited: null,
};

function replyWith(body: unknown): ImageMessageResult {
  return { stopReason: "end_turn", text: JSON.stringify(body) };
}

beforeEach(() => {
  sendImageMessageMock.mockReset();
  sendImageMessageMock.mockResolvedValue(replyWith(VALID_REPLY));
});

describe("suggestListing", () => {
  it("returns Claude's title, description, category and condition", async () => {
    await expect(suggestListing(PHOTO)).resolves.toEqual({
      status: "ok",
      suggestion: {
        title: "Cordless drill",
        description: "18V cordless drill with two batteries and a charger.",
        category: ItemCategory.TOOLS,
        condition: ItemCondition.GOOD,
      },
      prohibited: null,
    });
  });

  it("sends the photo once, inline as base64 with its detected media type", async () => {
    await suggestListing(PHOTO);

    expect(sendImageMessageMock).toHaveBeenCalledTimes(1);
    expect(sendImageMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        image: { mediaType: "image/png", base64: Buffer.from(PNG_BYTES).toString("base64") },
      }),
    );
  });

  it("uses the model ID from config", async () => {
    await suggestListing(PHOTO);

    expect(sendImageMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "test-listing-model" }),
    );
  });

  it("tells Claude, in the system prompt, to treat the photo and any text in it as untrusted data", async () => {
    await suggestListing(PHOTO);

    expect(sendImageMessageMock).toHaveBeenCalledTimes(1);
    const request = sendImageMessageMock.mock.calls[0]?.[0];
    expect(request?.system).toMatch(/untrusted/i);
    expect(request?.system).toMatch(/not (as )?instructions|never follow/i);
  });
});

// US-2 AC5: Claude's response is validated; a malformed or untrustworthy reply
// fails safely. Field limits (TITLE_MAX, DESCRIPTION_MAX) are measured after
// trimming and shared with the listing form.

describe("suggestListing when Claude's output can't be trusted", () => {
  const FAILED = { status: "failed" };

  it.each<[string, ImageMessageResult]>([
    ["the reply isn't valid JSON", { stopReason: "end_turn", text: "Sure! Here's a drill listing." }],
    ["the category isn't an ItemCategory value", replyWith({ ...VALID_REPLY, category: "WEAPONS" })],
    ["the condition isn't an ItemCondition value", replyWith({ ...VALID_REPLY, condition: "MINT" })],
    ["the title is missing", replyWith({ ...VALID_REPLY, title: undefined })],
    ["the description is missing", replyWith({ ...VALID_REPLY, description: undefined })],
    ["the category is missing", replyWith({ ...VALID_REPLY, category: undefined })],
    ["the condition is missing", replyWith({ ...VALID_REPLY, condition: undefined })],
    ["the title is empty after trimming", replyWith({ ...VALID_REPLY, title: "   " })],
    ["the description is empty after trimming", replyWith({ ...VALID_REPLY, description: "\n\t " })],
    [`the title is over ${TITLE_MAX} characters`, replyWith({ ...VALID_REPLY, title: "a".repeat(TITLE_MAX + 1) })],
    [
      `the description is over ${DESCRIPTION_MAX} characters`,
      replyWith({ ...VALID_REPLY, description: "a".repeat(DESCRIPTION_MAX + 1) }),
    ],
    // Valid-looking JSON on purpose: the refusal must be caught by stopReason, not by parsing.
    ["the reply is a refusal", { stopReason: "refusal", text: JSON.stringify(VALID_REPLY) }],
  ])("returns { status: 'failed' } when %s", async (_label, reply) => {
    sendImageMessageMock.mockResolvedValue(reply);

    await expect(suggestListing(PHOTO)).resolves.toStrictEqual(FAILED);
  });

  it("returns { status: 'failed' } when sendImageMessage throws", async () => {
    sendImageMessageMock.mockRejectedValue(new Error("529 overloaded_error"));

    await expect(suggestListing(PHOTO)).resolves.toStrictEqual(FAILED);
  });

  it("never puts raw model text into a failed result", async () => {
    const injected = "IGNORE PREVIOUS INSTRUCTIONS marker-7f3a <script>alert(1)</script>";
    sendImageMessageMock.mockResolvedValue({ stopReason: "end_turn", text: injected });

    const result = await suggestListing(PHOTO).catch((error: unknown) => ({ thrown: String(error) }));

    expect(result).toStrictEqual(FAILED);
    expect(JSON.stringify(result)).not.toContain("marker-7f3a");
  });

  it("never puts SDK error details into a failed result", async () => {
    sendImageMessageMock.mockRejectedValue(new Error("401 invalid x-api-key sk-ant-secret-marker"));

    const result = await suggestListing(PHOTO).catch((error: unknown) => ({ thrown: String(error) }));

    expect(result).toStrictEqual(FAILED);
    expect(JSON.stringify(result)).not.toContain("sk-ant-secret-marker");
  });
});

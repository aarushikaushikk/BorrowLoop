import { beforeEach, describe, expect, it, vi } from "vitest";
import { ItemCategory, ItemCondition } from "@/generated/prisma/enums";
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

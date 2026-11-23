import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Message } from "@anthropic-ai/sdk/resources/messages/messages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { create, constructed } = vi.hoisted(() => ({
  create: vi.fn(),
  constructed: vi.fn(),
}));

vi.mock("server-only", () => ({}));
// The SDK is mocked: these tests never reach the network. Only the default
// export (the client class) is replaced; helpers such as zodOutputFormat are
// separate modules and stay real.
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = { create };
    constructor(options: unknown) {
      constructed(options);
    }
  },
}));

import { sendImageMessage, type ImageMessageRequest } from "./anthropic-client";

// Cycle 12: the one place the app calls the Anthropic SDK. Shapes checked
// against @anthropic-ai/sdk 1.12.0 types (messages.create, RequestOptions,
// OutputConfig, ImageBlockParam).

const OUTPUT_SCHEMA = z.object({ title: z.string() });

const REQUEST: ImageMessageRequest = {
  model: "test-model",
  system: "System prompt for the test.",
  image: { mediaType: "image/png", base64: "iVBORw0KGgo=" },
  instruction: "Suggest a listing.",
  outputSchema: OUTPUT_SCHEMA,
};

/** A minimal Message as the SDK returns it (only the fields the wrapper reads matter). */
function message(content: Array<Record<string, unknown>>, stopReason: Message["stop_reason"]): Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "test-model",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
  } as unknown as Message;
}

/** The params passed to messages.create on its first call. */
function sentParams(): Record<string, unknown> {
  expect(create).toHaveBeenCalledTimes(1);
  return create.mock.calls[0]?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  create.mockReset();
  constructed.mockReset();
  create.mockResolvedValue(message([{ type: "text", text: '{"title":"Drill"}' }], "end_turn"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendImageMessage request", () => {
  it("sends the model, system prompt, max_tokens, and a base64 image block before the instruction text", async () => {
    await sendImageMessage(REQUEST);

    const params = sentParams();
    expect(params.model).toBe("test-model");
    expect(params.system).toBe("System prompt for the test.");
    expect(params.max_tokens).toEqual(expect.any(Number));
    expect(params.max_tokens as number).toBeGreaterThan(0);
    expect(params.messages).toStrictEqual([
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } },
          { type: "text", text: "Suggest a listing." },
        ],
      },
    ]);
  });

  it("sets effort 'low' and a structured-output format built from the caller's schema", async () => {
    await sendImageMessage(REQUEST);

    const outputConfig = sentParams().output_config as Record<string, unknown> | undefined;
    expect(outputConfig?.effort).toBe("low");
    const expected = zodOutputFormat(OUTPUT_SCHEMA);
    expect(outputConfig?.format).toMatchObject({ type: expected.type, schema: expected.schema });
  });

  it("sends no fallbacks and doesn't disable thinking", async () => {
    await sendImageMessage(REQUEST);

    const params = sentParams();
    expect(params).not.toHaveProperty("fallbacks");
    expect(params.thinking).not.toEqual({ type: "disabled" });
  });

  it("passes the caller's AbortSignal as a request option", async () => {
    const controller = new AbortController();

    await sendImageMessage({ ...REQUEST, signal: controller.signal });

    expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ signal: controller.signal }));
  });
});

describe("sendImageMessage result", () => {
  it("joins only the reply's text blocks", async () => {
    create.mockResolvedValue(
      message(
        [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "text", text: '{"title":' },
          { type: "text", text: '"Drill"}' },
        ],
        "end_turn",
      ),
    );

    await expect(sendImageMessage(REQUEST)).resolves.toStrictEqual({
      stopReason: "end_turn",
      text: '{"title":"Drill"}',
    });
  });

  it("returns a refusal as stopReason 'refusal' instead of throwing", async () => {
    create.mockResolvedValue(message([], "refusal"));

    await expect(sendImageMessage(REQUEST)).resolves.toStrictEqual({ stopReason: "refusal", text: "" });
  });

  it("lets SDK errors propagate unchanged", async () => {
    const sdkError = new Error("529 overloaded_error");
    create.mockRejectedValue(sdkError);

    await expect(sendImageMessage(REQUEST)).rejects.toBe(sdkError);
  });
});

describe("sendImageMessage client", () => {
  it("doesn't create a client on import, even without a key, and creates one with ANTHROPIC_API_KEY on first use", async () => {
    vi.resetModules();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fresh = await import("./anthropic-client");
    expect(constructed).not.toHaveBeenCalled();

    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-from-env");
    await fresh.sendImageMessage(REQUEST);
    await fresh.sendImageMessage(REQUEST);

    expect(constructed).toHaveBeenCalledTimes(1);
    expect(constructed).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "test-key-from-env" }));
  });
});

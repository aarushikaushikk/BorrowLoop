import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { config, uploadStream } = vi.hoisted(() => ({
  config: vi.fn(),
  uploadStream: vi.fn(),
}));

vi.mock("cloudinary", () => ({
  v2: { config, uploader: { upload_stream: uploadStream } },
}));

import { DEFAULT_FOLDER, uploadImage } from "./cloudinary";

type Callback = (error?: { message: string }, response?: Record<string, unknown>) => void;

/** Makes upload_stream call back with the given result once bytes are written. */
function mockUploadResult(error?: { message: string }, response?: Record<string, unknown>) {
  const end = vi.fn();
  uploadStream.mockImplementation((_options: unknown, callback: Callback) => {
    end.mockImplementation(() => callback(error, response));
    return { end };
  });
  return end;
}

describe("uploadImage", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uploads the bytes and returns the secure URL, public id and size", async () => {
    const end = mockUploadResult(undefined, {
      secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/borrowloop/items/abc.jpg",
      url: "http://insecure.example/abc.jpg",
      public_id: "borrowloop/items/abc",
      width: 800,
      height: 600,
    });
    const bytes = Buffer.from("fake-image");

    const result = await uploadImage(bytes);

    expect(result).toEqual({
      url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/borrowloop/items/abc.jpg",
      publicId: "borrowloop/items/abc",
      width: 800,
      height: 600,
    });
    expect(end).toHaveBeenCalledWith(bytes);
    expect(uploadStream).toHaveBeenCalledWith(
      { folder: DEFAULT_FOLDER, resource_type: "image" },
      expect.any(Function),
    );
    expect(config).toHaveBeenCalledWith(
      expect.objectContaining({ cloud_name: "demo-cloud", secure: true }),
    );
  });

  it("puts an allowed subfolder under the borrowloop folder", async () => {
    mockUploadResult(undefined, { secure_url: "https://x", public_id: "p", width: 1, height: 1 });

    await uploadImage(Buffer.from("x"), { folder: "test" });

    expect(uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ folder: "borrowloop/test" }),
      expect.any(Function),
    );
  });

  it.each(["other-app", "../outside", "borrowloop/items/../../x", ""])(
    "refuses folder %j outside the allowed list",
    async (folder) => {
      // Cast simulates an untyped value reaching the helper at runtime.
      await expect(uploadImage(Buffer.from("x"), { folder: folder as "items" })).rejects.toThrow(
        "Unknown upload folder",
      );
      expect(uploadStream).not.toHaveBeenCalled();
    },
  );

  it("rejects with a clear error when Cloudinary fails", async () => {
    mockUploadResult({ message: "Invalid API key" });

    await expect(uploadImage(Buffer.from("x"))).rejects.toThrow(
      "Cloudinary upload failed: Invalid API key",
    );
  });

  it("refuses to upload when credentials are missing", async () => {
    vi.stubEnv("CLOUDINARY_API_SECRET", "");

    await expect(uploadImage(Buffer.from("x"))).rejects.toThrow(
      "Cloudinary is not configured. Missing: CLOUDINARY_API_SECRET",
    );
    expect(uploadStream).not.toHaveBeenCalled();
  });
});

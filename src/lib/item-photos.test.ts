import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { uploadImage } = vi.hoisted(() => ({ uploadImage: vi.fn() }));
vi.mock("./cloudinary", () => ({ uploadImage }));

import { createPrismaClient } from "./prisma";
import { saveItemPhoto } from "./item-photos";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// Runs against a real Postgres (the separate test database), so it also checks
// that the migration and ItemPhoto columns line up. Skipped when no test DB is set.
describe.skipIf(!testDatabaseUrl)("saveItemPhoto (test database)", () => {
  const db = testDatabaseUrl ? createPrismaClient(testDatabaseUrl) : null!;
  let itemId: string;

  beforeEach(async () => {
    await db.user.deleteMany({ where: { email: "photo-test@example.com" } });
    await db.community.deleteMany({ where: { slug: "photo-test" } });

    const user = await db.user.create({ data: { email: "photo-test@example.com" } });
    const community = await db.community.create({ data: { name: "Photo test", slug: "photo-test" } });
    const item = await db.item.create({
      data: {
        ownerId: user.id,
        communityId: community.id,
        title: "Cordless drill",
        description: "18V, two batteries",
        category: "TOOLS",
        condition: "GOOD",
      },
    });
    itemId = item.id;

    uploadImage.mockReset();
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: "photo-test@example.com" } });
    await db.community.deleteMany({ where: { slug: "photo-test" } });
    await db.$disconnect();
  });

  it("stores the uploaded image URL on a new ItemPhoto", async () => {
    uploadImage.mockResolvedValue({
      url: "https://res.cloudinary.com/demo/image/upload/drill.jpg",
      publicId: "borrowloop/items/drill",
      width: 1200,
      height: 900,
    });

    const photo = await saveItemPhoto(db, itemId, Buffer.from("img"));

    const stored = await db.itemPhoto.findUniqueOrThrow({ where: { id: photo.id } });
    expect(stored).toMatchObject({
      itemId,
      url: "https://res.cloudinary.com/demo/image/upload/drill.jpg",
      publicId: "borrowloop/items/drill",
      width: 1200,
      height: 900,
      position: 0,
    });
  });

  it("appends later photos after existing ones", async () => {
    uploadImage
      .mockResolvedValueOnce({ url: "https://x/1.jpg", publicId: "p1", width: 1, height: 1 })
      .mockResolvedValueOnce({ url: "https://x/2.jpg", publicId: "p2", width: 1, height: 1 });

    await saveItemPhoto(db, itemId, Buffer.from("1"));
    const second = await saveItemPhoto(db, itemId, Buffer.from("2"));

    expect(second.position).toBe(1);
  });

  it("does not create a row when the upload fails", async () => {
    uploadImage.mockRejectedValue(new Error("Cloudinary upload failed: boom"));

    await expect(saveItemPhoto(db, itemId, Buffer.from("x"))).rejects.toThrow("boom");
    expect(await db.itemPhoto.count({ where: { itemId } })).toBe(0);
  });
});

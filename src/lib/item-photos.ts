import type { ItemPhoto, PrismaClient } from "@/generated/prisma/client";
import { uploadImage } from "./cloudinary";

type PhotoDb = Pick<PrismaClient, "itemPhoto">;

/**
 * Uploads a photo for an item and stores the resulting URL on a new ItemPhoto row.
 * The new photo goes after any existing ones (position 0 is the cover).
 * Callers must check that the current user owns the item before calling this.
 */
export async function saveItemPhoto(db: PhotoDb, itemId: string, data: Buffer): Promise<ItemPhoto> {
  const uploaded = await uploadImage(data);
  const position = await db.itemPhoto.count({ where: { itemId } });

  return db.itemPhoto.create({
    data: {
      itemId,
      url: uploaded.url,
      publicId: uploaded.publicId,
      width: uploaded.width,
      height: uploaded.height,
      position,
    },
  });
}

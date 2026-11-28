import type { ReactElement } from "react";

/**
 * The member-only part of /c/[communityId]/items/[itemId]: the item, its
 * blocked dates, and (for its owner) the availability controls.
 *
 * RED placeholder (cycle 3).
 */
export async function ItemDetailContent({ params }: { params: Promise<unknown> }): Promise<ReactElement> {
  void params;
  return <p>RED placeholder</p>;
}

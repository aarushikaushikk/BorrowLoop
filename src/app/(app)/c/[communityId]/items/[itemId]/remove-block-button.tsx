"use client";

import type { ReactElement } from "react";

/**
 * The "Remove" button for one blocked range. Submits only the community and
 * block IDs; who may remove it is decided on the server.
 *
 * RED placeholder (cycle 3).
 */
export function RemoveBlockButton(props: {
  communityId: string;
  availabilityId: string;
  rangeLabel: string;
}): ReactElement | null {
  void props;
  return null;
}

import { z } from "zod";

/**
 * An opaque community identifier taken from untrusted input (route params or
 * form data).
 *
 * Deliberately loose so that it accepts both cuid- and UUID-style IDs. Tighten
 * it once the Prisma schema fixes the ID format.
 */
export const communityIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/**
 * Route params or form fields that identify a community.
 *
 * Strict: unknown keys (for example a client-supplied `userId` or `role`) are
 * rejected rather than silently ignored, so they can't be confused with
 * server-derived values.
 */
export const communityParamsSchema = z.strictObject({
  communityId: communityIdSchema,
});

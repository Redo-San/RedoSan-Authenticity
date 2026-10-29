// Runtime-message names shared by the background and the injected inspector.
// Kept in one module so the two sides cannot drift apart silently.

/** Message type that asks the injected inspector to inspect one image. */
export const INSPECT_MESSAGE = "redosan:inspect";

/** Limit for a fetched image; larger files are rejected before hashing. */
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

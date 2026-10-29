// URL helpers for the context-menu path, where the image is identified by the
// address the page used rather than by a File object.

const FETCHABLE_PROTOCOLS = new Set(["http:", "https:", "data:", "blob:"]);

/**
 * Can this address be fetched from a content script?
 *
 * Only the schemes a page can display and a content script can read are
 * accepted; `javascript:`, `chrome:` and `file:` are rejected so a crafted page
 * cannot steer the inspector at another origin.
 * @param {string} value Address from the context-menu click.
 * @param {string} [baseUrl] Base for relative addresses; defaults to the
 *   current document.
 * @returns {boolean} True when the address uses a fetchable scheme.
 */
export function isFetchableImageUrl(value, baseUrl) {
  if (typeof value !== "string" || value === "") return false;
  try {
    const url = new URL(value, baseUrl);
    return FETCHABLE_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Best-effort file name for an address, used for the report header and for
 * deciding whether the bytes are an image by extension.
 * @param {string} value Image address.
 * @param {string} [fallback] Name to use when the address carries none.
 * @returns {string} Last path segment, percent-decoded, or `fallback`.
 */
export function fileNameFromUrl(value, fallback = "image") {
  if (typeof value !== "string" || value === "") return fallback;
  let url;
  try {
    url = new URL(value, "https://extension.invalid/");
  } catch {
    return fallback;
  }
  if (url.protocol === "data:" || url.protocol === "blob:") return fallback;
  const segment = url.pathname.split("/").pop() ?? "";
  if (segment === "") return fallback;
  try {
    return decodeURIComponent(segment) || fallback;
  } catch {
    return segment;
  }
}

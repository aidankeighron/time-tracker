// Utility functions

/**
 * Extracts the hostname from a URL.
 * @param {string} url - The URL to parse.
 * @returns {string|null} - The hostname or null if invalid.
 */
export function getHostname(url) {
  try {
    const u = new URL(url);
    // Ignore chrome://, about:, and other non-http protocols if not needed, 
    // but user asked for website usage, so usually http/https.
    if (!['http:', 'https:'].includes(u.protocol)) {
      return null;
    }
    return u.hostname;
  } catch (e) {
    return null;
  }
}

/**
 * Returns the current date in YYYY-MM-DD format.
 * @returns {string}
 */
export function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

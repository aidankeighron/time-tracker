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

/**
 * Gets or creates a unique device identifier for this browser installation.
 * The device ID is stored in chrome.storage.local and persists across sessions.
 * @returns {Promise<string>} - The device ID.
 */
export async function getOrCreateDeviceId() {
  const DEVICE_ID_KEY = '__device_id__';
  
  const result = await chrome.storage.local.get([DEVICE_ID_KEY]);
  
  if (result[DEVICE_ID_KEY]) {
    return result[DEVICE_ID_KEY];
  }
  
  // Generate a new device ID: timestamp + random string
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  const deviceId = `${timestamp}-${randomStr}`;
  
  await chrome.storage.local.set({ [DEVICE_ID_KEY]: deviceId });
  console.log('Generated new device ID:', deviceId);
  
  return deviceId;
}

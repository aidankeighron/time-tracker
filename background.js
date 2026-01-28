// Cross-browser API compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

import { getHostname, getTodayString, getOrCreateDeviceId } from './utils.js';

// State to track current active tab
let currentTabId = null;
let currentUrl = null;
let startTime = null;
let deviceId = null;

// Load config
let config = null;

async function loadConfig() {
  try {
    const url = browserAPI.runtime.getURL('config.json');
    const response = await fetch(url);
    config = await response.json();
    console.log('Config loaded');
  } catch (e) {
    console.error('Failed to load config:', e);
  }
}

async function initialize() {
  await loadConfig();
  deviceId = await getOrCreateDeviceId();
  console.log('Device ID:', deviceId);
}

initialize();

// --- Tracking Logic ---

function stopTracking() {
  if (currentUrl && startTime) {
    const now = Date.now();
    const duration = Math.floor((now - startTime) / 1000); // seconds
    if (duration > 0) {
      updateStorage(currentUrl, duration);
    }
  }
  currentUrl = null;
  startTime = null;
}

function startTracking(url) {
  const hostname = getHostname(url);
  if (hostname) {
    currentUrl = hostname;
    startTime = Date.now();
  }
}

async function updateStorage(hostname, duration) {
  const today = getTodayString();
  const key = `${today}::${deviceId}::${hostname}`;

  const result = await browserAPI.storage.local.get([key]);
  const currentTotal = result[key] || 0;
  const newTotal = currentTotal + duration;

  await browserAPI.storage.local.set({ [key]: newTotal });
  console.log(`Updated ${key}: +${duration}s = ${newTotal}s`);
}

// Listeners
browserAPI.tabs.onActivated.addListener(async (activeInfo) => {
  stopTracking();
  currentTabId = activeInfo.tabId;
  const tab = await browserAPI.tabs.get(currentTabId);
  if (tab.url) {
    startTracking(tab.url);
  }
});

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.url) {
    stopTracking();
    startTracking(changeInfo.url);
  }
});

browserAPI.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browserAPI.windows.WINDOW_ID_NONE) {
    stopTracking();
  } else {
    // Window gained focus, check active tab
    const tabs = await browserAPI.tabs.query({ active: true, windowId: windowId });
    if (tabs.length > 0) {
      stopTracking(); // Ensure we close any previous session
      currentTabId = tabs[0].id;
      if (tabs[0].url) {
        startTracking(tabs[0].url);
      }
    }
  }
});

// Per minute "tick" to save progress so we don't lose too much on crash
browserAPI.alarms.create('tracking_tick', { periodInMinutes: 1 });
browserAPI.alarms.create('sync_tick', { periodInMinutes: 5 });

browserAPI.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'tracking_tick') {
    // If currently tracking, save partial progress and restart timer
    if (currentUrl && startTime) {
      const now = Date.now();
      const duration = Math.floor((now - startTime) / 1000);
      if (duration > 0) {
        await updateStorage(currentUrl, duration);
        startTime = now; // Restart start time
      }
    }
  } else if (alarm.name === 'sync_tick') {
    syncToSupabase();
  }
});

// --- Messages ---
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'manual_sync') {
    syncToSupabase().then((result) => {
      sendResponse(result);
    });
    return true; // Indicates we response asynchronously
  }
});

// --- Sync Logic ---

async function syncToSupabase() {
  if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    console.warn('Supabase config missing');
    return { success: false, error: 'Config missing' };
  }
  
  // Make sure we flush current usage first
  if (currentUrl && startTime) {
      const now = Date.now();
      const duration = Math.floor((now - startTime) / 1000);
      if (duration > 0) {
        await updateStorage(currentUrl, duration);
        startTime = now;
      }
  }

  const today = getTodayString();
  const allData = await browserAPI.storage.local.get(null);
  
  // Filter for today's entries
  const rowsToUpsert = [];
  for (const [key, val] of Object.entries(allData)) {
    if (key.startsWith(`${today}::`)) {
      // val is in seconds.
      // Filter: Only save if used for longer than 1 minute (60 seconds)
      if (val < 60) {
        continue;
      }

      // Parse key format: date::deviceId::website
      const parts = key.split('::');
      if (parts.length !== 3) {
        continue; // Skip malformed keys
      }
      
      const [, device, website] = parts;
      const minutes = Math.round(val / 60);

      rowsToUpsert.push({
        date: today,
        website: website,
        device: device,
        timespent: minutes // Sending minutes now
      });
    }
  }

  if (rowsToUpsert.length === 0) {
    console.log("No data to sync.");
    return { success: true, message: 'No data to sync' };
  }

  console.log(`Syncing ${rowsToUpsert.length} rows to Supabase...`);

  try {
    const response = await fetch(`${config.SUPABASE_URL}/rest/v1/website_usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(rowsToUpsert)
    });

    if (response.ok) {
      console.log('Sync successful');
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error('Sync failed', errorText);
      return { success: false, error: errorText };
    }
  } catch (err) {
    console.error('Network error during sync', err);
    return { success: false, error: err.message };
  }
}

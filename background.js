import { getHostname, getTodayString } from './utils.js';

// State to track current active tab
let currentTabId = null;
let currentUrl = null;
let startTime = null;

// Load config
let config = null;

async function loadConfig() {
  try {
    const url = chrome.runtime.getURL('config.json');
    const response = await fetch(url);
    config = await response.json();
    console.log('Config loaded');
  } catch (e) {
    console.error('Failed to load config:', e);
  }
}

loadConfig();

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
  const key = `${today}::${hostname}`;

  const result = await chrome.storage.local.get([key]);
  const currentTotal = result[key] || 0;
  const newTotal = currentTotal + duration;

  await chrome.storage.local.set({ [key]: newTotal });
  console.log(`Updated ${key}: +${duration}s = ${newTotal}s`);
}

// Listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  stopTracking();
  currentTabId = activeInfo.tabId;
  const tab = await chrome.tabs.get(currentTabId);
  if (tab.url) {
    startTracking(tab.url);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.url) {
    stopTracking();
    startTracking(changeInfo.url);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    stopTracking();
  } else {
    // Window gained focus, check active tab
    const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
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
chrome.alarms.create('tracking_tick', { periodInMinutes: 1 });
chrome.alarms.create('sync_tick', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
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

// --- Sync Logic ---

async function syncToSupabase() {
  if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    console.warn('Supabase config missing');
    return;
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
  const allData = await chrome.storage.local.get(null);
  
  // Filter for today's entries
  const rowsToUpsert = [];
  for (const [key, val] of Object.entries(allData)) {
    if (key.startsWith(`${today}::`)) {
      const website = key.split('::')[1];
      rowsToUpsert.push({
        date: today,
        website: website,
        timespent: val
      });
    }
  }

  if (rowsToUpsert.length === 0) {
    console.log("No data to sync.");
    return;
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
    } else {
      console.error('Sync failed', await response.text());
    }
  } catch (err) {
    console.error('Network error during sync', err);
  }
}

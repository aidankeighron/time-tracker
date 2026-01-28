# Supabase Time Tracker Extension

A browser extension that tracks time spent on websites and syncs it to a Supabase database.

## Setup

1.  **Config:** Update `config.json` with your Supabase URL and Anon Key.
2.  **Database:** Ensure your `website_usage` table is created and RLS is enabled (see previous SQL).

## Installation

### Chrome
1.  Go to `chrome://extensions/`
2.  Enable **Developer mode**.
3.  Click **Load unpacked**.
4.  Select this folder.

### Firefox
1.  Go to `about:debugging#/runtime/this-firefox`
2.  Click **Load Temporary Add-on...**
3.  Select the **`manifest-firefox.json`** file.
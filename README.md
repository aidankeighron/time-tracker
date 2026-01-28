# Supabase Time Tracker Extension

A browser extension that tracks time spent on websites and syncs it to a Supabase database.

## Setup

### 1. Database Setup
Run this SQL in your Supabase SQL Editor to create the necessary table:

```sql
-- 1. Create the table
create table public.website_usage (
  date date not null,
  website text not null,
  timespent int default 0,
  last_updated_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (date, website)
);

-- 2. Enable Row Level Security (RLS)
alter table public.website_usage enable row level security;

-- 3. Create Policy for Anonymous Access
-- This allows anyone with the Anon Key to Insert, Update, and Select data.
create policy "Allow Anon Access"
on public.website_usage
for all
to anon
using (true)
with check (true);
```

### 2. Configuration
Open `config.json` and update the values with your project URL and Anon Key:
```json
{
  "SUPABASE_URL": "https://your-project.supabase.co",
  "SUPABASE_ANON_KEY": "your-anon-key"
}
```

### 3. Installation

**Chrome:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode" (top right).
3. Click "Load unpacked".
4. Select this directory (`time-tracker`).

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on...".
3. Select the `manifest.json` file.

## Usage
- The extension runs in the background.
- It tracks the active tab time.
- Every 5 minutes, it syncs the data to Supabase.
- You can inspect `chrome.storage.local` in the background script console to see local data.

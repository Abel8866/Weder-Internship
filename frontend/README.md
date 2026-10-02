# Offline Field Issue Tracker Frontend Offline Layer

This React/Vite frontend provides the durable field-worker storage and
synchronization layer. Dexie.js stores reports in IndexedDB; the
`OfflineSyncService` owns online/offline detection, sequential retries, and
failure preservation.

## Setup

```powershell
cd "C:\Users\Admin\Documents\Weder Internship\frontend"
npm install
Copy-Item .env.example .env
npm run dev
```

Run the frontend test suite:

```powershell
npm test
```

The Vitest/React Testing Library suite uses a real Dexie database backed by
`fake-indexeddb` and covers offline queue persistence, coordinator transition
requests, and pending-to-synced updates after a successful API response.

The frontend defaults to `http://localhost:3000` for the backend API. Change
`VITE_API_BASE_URL` in `.env` when the API is hosted elsewhere.

## Local schema

The `local_reports` Dexie table contains:

| Field | Purpose |
|---|---|
| `id` | Client-generated UUID and primary key |
| `category` | Infrastructure category |
| `description` | Worker observation |
| `location` | GPS/manual location object |
| `priority` | `low`, `medium`, `high`, or `critical` |
| `status` | Server workflow status |
| `reported_at` | Client capture time |
| `sync_status` | `pending`, `synced`, or `failed` |
| `last_sync_attempt` | Last request attempt timestamp |
| `retry_count` | Number of attempts made |

## Service behavior

`OfflineSyncService`:

- Registers `online` and `offline` listeners.
- Reads the initial `navigator.onLine` state.
- Saves locally before attempting network synchronization.
- Queries both `pending` and `failed` reports.
- Sends reports sequentially to `POST /api/reports/sync`.
- Binds the browser's native `fetch` method before use so Chromium does not
  reject it as an illegal invocation.
- Uses a stable `Idempotency-Key` per report and capture timestamp.
- Marks a successful HTTP response as `synced`.
- Marks network failures, HTTP 500s, validation errors, and other non-2xx
  responses as `failed` while retaining the complete record.
- Automatically retries on the next `online` event; the UI can call
  `triggerSync()` for a manual retry.

Example integration:

```jsx
const { saveReportLocally, triggerSync, reports } = useOfflineSync();

await saveReportLocally({
  category: 'water_pump',
  description: 'Pump is leaking at the north access point',
  location: {
    latitude: 51.501,
    longitude: -0.141,
    accuracy: 12,
    source: 'gps'
  },
  priority: 'high',
  status: 'submitted',
  reported_at: new Date().toISOString()
});
```

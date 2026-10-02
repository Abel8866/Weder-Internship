import React from 'react';
import { createRoot } from 'react-dom/client';
import { useOfflineSync } from './useOfflineSync';

function App() {
  const { isOnline, isSyncing, reports, triggerSync } = useOfflineSync();
  const pending = reports.filter((report) => report.sync_status !== 'synced').length;

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Offline Field Issue Tracker</h1>
      <p role="status">
        {isOnline ? 'Online' : 'Offline'} · {isSyncing ? 'Syncing…' : `${pending} item(s) awaiting sync`}
      </p>
      <button type="button" onClick={triggerSync} disabled={!isOnline || isSyncing}>
        Retry sync
      </button>
      <ul>
        {reports.map((report) => (
          <li key={report.id}>
            {report.category}: {report.description} — {report.sync_status}
          </li>
        ))}
      </ul>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


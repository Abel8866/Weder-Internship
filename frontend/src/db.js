import Dexie from 'dexie';

/**
 * Durable client-side source of truth for field reports.
 *
 * `id` is the client-generated UUID and is deliberately the primary key. The
 * sync service can therefore safely retry a report without creating a second
 * local record.
 */
export const localDb = new Dexie('offline-field-issue-tracker');

localDb.version(1).stores({
  local_reports: [
    'id',
    'category',
    'priority',
    'status',
    'reported_at',
    'sync_status',
    'last_sync_attempt',
    'retry_count'
  ].join(', ')
});

export const localReports = localDb.local_reports;

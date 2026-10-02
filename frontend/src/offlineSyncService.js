import { localReports } from './db';

const RETRYABLE_STATUSES = new Set(['pending', 'failed']);

function createUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  throw new Error('This browser does not support secure UUID generation');
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeReport(data) {
  return {
    id: data.id || createUuid(),
    category: data.category,
    description: data.description,
    location: data.location,
    priority: data.priority,
    status: data.status || 'submitted',
    reported_at: data.reported_at || nowIso(),
    sync_status: 'pending',
    last_sync_attempt: null,
    retry_count: 0
  };
}

function responseError(response, body) {
  const error = new Error(
    body?.error?.message || `Sync request failed with HTTP ${response.status}`
  );
  error.status = response.status;
  error.code = body?.error?.code || 'SYNC_REQUEST_FAILED';
  error.details = body?.error || null;
  return error;
}

export class OfflineSyncService {
  constructor({
    apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    fetchImpl,
    database = localReports,
    onStateChange
  } = {}) {
    const resolvedFetch = fetchImpl || globalThis.fetch?.bind(globalThis);
    if (typeof resolvedFetch !== 'function') {
      throw new Error('A fetch implementation is required for synchronization');
    }

    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    this.fetchImpl = resolvedFetch;
    this.database = database;
    this.onStateChange = onStateChange;
    this.isOnline = globalThis.navigator?.onLine ?? true;
    this.isSyncing = false;
    this.boundOnlineHandler = () => {
      this.isOnline = true;
      this.emitState();
      void this.triggerSync();
    };
    this.boundOfflineHandler = () => {
      this.isOnline = false;
      this.emitState();
    };

    globalThis.window?.addEventListener('online', this.boundOnlineHandler);
    globalThis.window?.addEventListener('offline', this.boundOfflineHandler);
  }

  destroy() {
    globalThis.window?.removeEventListener('online', this.boundOnlineHandler);
    globalThis.window?.removeEventListener('offline', this.boundOfflineHandler);
  }

  emitState(extra = {}) {
    this.onStateChange?.({
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      ...extra
    });
  }

  async saveReportLocally(data) {
    const report = normalizeReport(data);
    await this.database.put(report);
    this.emitState({ lastSavedReport: report });

    if (this.isOnline) {
      void this.triggerSync();
    }
    return report;
  }

  async getLocalReports() {
    return this.database.orderBy('reported_at').reverse().toArray();
  }

  async getSyncQueue() {
    const reports = await this.database.toArray();
    return reports.filter((report) => RETRYABLE_STATUSES.has(report.sync_status));
  }

  async triggerSync() {
    if (this.isSyncing || !this.isOnline) {
      return { attempted: 0, synced: 0, skipped: true };
    }

    this.isSyncing = true;
    this.emitState({ syncError: null });
    let attempted = 0;
    let synced = 0;

    try {
      const queue = await this.getSyncQueue();
      for (const report of queue) {
        if (!this.isOnline) break;
        attempted += 1;
        const didSync = await this.syncOne(report);
        if (didSync) synced += 1;
      }
    } finally {
      this.isSyncing = false;
      this.emitState();
    }

    return { attempted, synced, skipped: false };
  }

  async syncOne(report) {
    const attemptAt = nowIso();
    const retryCount = (report.retry_count || 0) + 1;
    await this.database.update(report.id, {
      last_sync_attempt: attemptAt,
      retry_count: retryCount
    });

    try {
      const response = await this.fetchImpl(`${this.apiBaseUrl}/api/reports/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Stable across retries so a response lost to a network drop is safe
          // to replay at the server.
          'Idempotency-Key': `report-sync-${report.id}-${report.reported_at}`
        },
        body: JSON.stringify({
          id: report.id,
          category: report.category,
          description: report.description,
          location: report.location,
          priority: report.priority,
          status: report.status,
          reported_at: report.reported_at
        })
      });

      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok) {
        throw responseError(response, body);
      }

      await this.database.update(report.id, {
        sync_status: 'synced',
        last_sync_attempt: attemptAt,
        retry_count: retryCount
      });
      this.emitState({ syncedReport: report.id });
      return true;
    } catch (error) {
      await this.database.update(report.id, {
        sync_status: 'failed',
        last_sync_attempt: attemptAt,
        retry_count: retryCount
      });
      this.emitState({
        failedReport: report.id,
        syncError: {
          reportId: report.id,
          status: error.status || null,
          code: error.code || 'NETWORK_ERROR',
          message: error.message
        }
      });
      return false;
    }
  }
}

export const offlineSyncService = new OfflineSyncService();

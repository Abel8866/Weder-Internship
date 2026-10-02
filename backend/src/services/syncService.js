const {
  db,
  getReportById,
  getSyncLog,
  insertSyncLog,
  updateReport,
  insertHistory
} = require('../database/repositories');
const reportService = require('./reportService');
const { newId, nowIso } = require('../utils/ids');
const { conflictError } = require('../utils/errors');

function serializeOutcome(outcome) {
  return JSON.stringify(outcome);
}

function syncReports(payload, idempotencyKey) {
  const items = Array.isArray(payload.items) ? payload.items : [payload];
  const existingLog = getSyncLog(idempotencyKey);
  if (existingLog) {
    if (existingLog.status !== 'succeeded') {
      throw conflictError('IDEMPOTENCY_KEY_REUSED', 'The idempotency key has already produced a non-success outcome');
    }
    return JSON.parse(existingLog.error_details);
  }

  const transaction = db.transaction(() => {
    const results = [];
    for (const item of items) {
      const current = getReportById(item.id);
      if (!current) {
        const created = reportService.createReport(item, {
          clientSyncedAt: nowIso(),
          actorRole: 'field_worker'
        });
        results.push({
          id: created.id,
          outcome: 'synced',
          status: created.status,
          serverUpdatedAt: created.updatedAt
        });
        continue;
      }

      const updatedAt = nowIso();
      const updated = {
        ...current,
        category: item.category,
        description: item.description,
        location: item.location,
        priority: item.priority,
        status: current.status,
        updatedAt,
        clientSyncedAt: updatedAt,
        createdAt: current.createdAt
      };
      updateReport(updated);
      insertHistory({
        id: newId(),
        reportId: updated.id,
        previousStatus: current.status,
        newStatus: current.status,
        actorRole: 'system',
        note: 'Report Synchronized',
        timestamp: updatedAt
      });
      results.push({
        id: updated.id,
        outcome: 'existing_updated',
        status: updated.status,
        serverUpdatedAt: updated.updatedAt
      });
    }

    const response = { results };
    insertSyncLog({
      id: newId(),
      idempotencyKey,
      reportId: items.length === 1 ? items[0].id : `batch:${items.length}`,
      status: 'succeeded',
      errorDetails: serializeOutcome(response),
      timestamp: nowIso()
    });
    return response;
  });
  return transaction();
}

module.exports = { syncReports };

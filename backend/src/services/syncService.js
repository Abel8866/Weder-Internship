const {
  db,
  getReportById,
  getSyncLog,
  insertSyncLog,
  updateReport
} = require('../database/repositories');
const reportService = require('./reportService');
const { newId, nowIso } = require('../utils/ids');
const { conflictError, validationError } = require('../utils/errors');

function serializeOutcome(outcome) {
  return JSON.stringify(outcome);
}

function syncReports(items, idempotencyKey) {
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

      if (item.operation === 'create') {
        throw conflictError('REPORT_ALREADY_EXISTS', 'A report with this id already exists', {
          reportId: item.id
        });
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
        clientSyncedAt: updatedAt
      };
      updateReport(updated);
      results.push({
        id: updated.id,
        outcome: 'synced',
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

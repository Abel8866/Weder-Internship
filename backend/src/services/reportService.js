const {
  db,
  getReportById,
  insertReport,
  listReports,
  getHistory,
  updateReportStatus,
  insertHistory
} = require('../database/repositories');
const { newId, nowIso } = require('../utils/ids');
const { AppError, conflictError, validationError } = require('../utils/errors');

const allowedTransitions = {
  draft: ['submitted'],
  submitted: ['assigned', 'rejected'],
  assigned: ['in_progress', 'rejected'],
  in_progress: ['resolved'],
  resolved: [],
  rejected: []
};

function createReport(payload, options = {}) {
  const timestamp = nowIso();
  const report = {
    id: payload.id,
    category: payload.category,
    description: payload.description,
    location: payload.location,
    priority: payload.priority,
    status: payload.status || 'submitted',
    createdAt: options.createdAt || timestamp,
    updatedAt: timestamp,
    clientSyncedAt: options.clientSyncedAt || timestamp
  };

  insertReport(report);
  insertHistory({
    id: newId(),
    reportId: report.id,
    previousStatus: null,
    newStatus: report.status,
    actorRole: options.actorRole || 'field_worker',
    note: options.note || null,
    timestamp
  });
  return report;
}

function list(filters) {
  return listReports(filters);
}

function getById(id) {
  const report = getReportById(id);
  if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report was not found');
  return report;
}

function history(id) {
  getById(id);
  return getHistory(id);
}

function transition(id, payload, actorRole = 'coordinator') {
  const transaction = db.transaction(() => {
    const report = getReportById(id);
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report was not found');
    if (report.status !== payload.expectedStatus) {
      throw conflictError('STALE_REPORT', 'Report status has changed since it was loaded', {
        currentStatus: report.status,
        requestedStatus: payload.newStatus,
        allowedTransitions: allowedTransitions[report.status]
      });
    }
    if (!allowedTransitions[report.status].includes(payload.newStatus)) {
      throw conflictError('INVALID_TRANSITION', `Cannot transition from ${report.status} to ${payload.newStatus}`, {
        currentStatus: report.status,
        requestedStatus: payload.newStatus,
        allowedTransitions: allowedTransitions[report.status]
      });
    }
    if (payload.newStatus === 'rejected' && !payload.reason) {
      throw validationError('A rejection reason is required', { fieldErrors: { reason: ['Required'] } });
    }
    if (payload.newStatus === 'assigned' && !payload.assignee) {
      throw validationError('An assignee is required', { fieldErrors: { assignee: ['Required'] } });
    }

    const timestamp = nowIso();
    updateReportStatus(id, payload.newStatus, timestamp);
    insertHistory({
      id: newId(),
      reportId: id,
      previousStatus: report.status,
      newStatus: payload.newStatus,
      actorRole,
      note: payload.reason || (payload.assignee ? `Assigned to ${payload.assignee}` : null),
      timestamp
    });
    return getReportById(id);
  });
  return transaction();
}

module.exports = { allowedTransitions, createReport, list, getById, history, transition };

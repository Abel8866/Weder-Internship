const db = require('./connection');

const reportStatements = {
  findById: db.prepare('SELECT * FROM reports WHERE id = ?'),
  insert: db.prepare(`
    INSERT INTO reports
      (id, category, description, location, priority, status, created_at, updated_at, client_synced_at)
    VALUES
      (@id, @category, @description, @location, @priority, @status, @createdAt, @updatedAt, @clientSyncedAt)
  `),
  update: db.prepare(`
    UPDATE reports
    SET category = @category,
        description = @description,
        location = @location,
        priority = @priority,
        status = @status,
        updated_at = @updatedAt,
        client_synced_at = @clientSyncedAt
    WHERE id = @id
  `),
  updateStatus: db.prepare(`
    UPDATE reports
    SET status = @status, updated_at = @updatedAt
    WHERE id = @id
  `)
};

function mapReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    location: JSON.parse(row.location),
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientSyncedAt: row.client_synced_at
  };
}

function insertReport(report) {
  reportStatements.insert.run({
    ...report,
    location: JSON.stringify(report.location),
    clientSyncedAt: report.clientSyncedAt || null
  });
}

function updateReport(report) {
  reportStatements.update.run({
    ...report,
    location: JSON.stringify(report.location),
    clientSyncedAt: report.clientSyncedAt || null
  });
}

function getReportById(id) {
  return mapReport(reportStatements.findById.get(id));
}

function updateReportStatus(id, status, updatedAt) {
  reportStatements.updateStatus.run({ id, status, updatedAt });
}

function listReports(filters) {
  const conditions = [];
  const values = [];

  if (filters.status?.length) {
    conditions.push(`status IN (${filters.status.map(() => '?').join(', ')})`);
    values.push(...filters.status);
  }
  if (filters.priority) {
    conditions.push('priority = ?');
    values.push(filters.priority);
  }
  if (filters.category) {
    conditions.push('category = ?');
    values.push(filters.category);
  }
  if (filters.createdFrom) {
    conditions.push('created_at >= ?');
    values.push(filters.createdFrom);
  }
  if (filters.createdTo) {
    conditions.push('created_at <= ?');
    values.push(filters.createdTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const count = db.prepare(`SELECT COUNT(*) AS total FROM reports ${where}`).get(...values).total;
  const rows = db.prepare(`
    SELECT * FROM reports ${where}
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...values, filters.pageSize, (filters.page - 1) * filters.pageSize);

  return { total: count, data: rows.map(mapReport) };
}

function insertHistory(event) {
  db.prepare(`
    INSERT INTO report_history
      (id, report_id, previous_status, new_status, actor_role, note, timestamp)
    VALUES
      (@id, @reportId, @previousStatus, @newStatus, @actorRole, @note, @timestamp)
  `).run(event);
}

function getHistory(reportId, pagination = { page: 1, pageSize: 25 }) {
  const total = db.prepare(`
    SELECT COUNT(*) AS total
    FROM report_history
    WHERE report_id = ?
  `).get(reportId).total;
  const events = db.prepare(`
    SELECT id, report_id AS reportId, previous_status AS previousStatus,
      new_status AS newStatus, actor_role AS actorRole, note, timestamp
    FROM report_history
    WHERE report_id = ?
    ORDER BY timestamp ASC, id ASC
    LIMIT ? OFFSET ?
  `).all(
    reportId,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize
  );
  return { total, events };
}

function insertSyncLog(log) {
  db.prepare(`
    INSERT INTO sync_logs
      (id, idempotency_key, report_id, status, error_details, timestamp)
    VALUES
      (@id, @idempotencyKey, @reportId, @status, @errorDetails, @timestamp)
  `).run(log);
}

function getSyncLog(idempotencyKey) {
  return db.prepare('SELECT * FROM sync_logs WHERE idempotency_key = ?').get(idempotencyKey);
}

module.exports = {
  db,
  getReportById,
  insertReport,
  updateReport,
  updateReportStatus,
  listReports,
  insertHistory,
  getHistory,
  insertSyncLog,
  getSyncLog,
  mapReport
};

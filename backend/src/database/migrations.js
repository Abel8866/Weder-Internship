const db = require('./connection');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      status TEXT NOT NULL CHECK (
        status IN ('draft', 'submitted', 'assigned', 'in_progress', 'resolved', 'rejected')
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      client_synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS report_history (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      actor_role TEXT NOT NULL CHECK (actor_role IN ('field_worker', 'coordinator', 'system')),
      note TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      report_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('received', 'succeeded', 'failed', 'conflict')),
      error_details TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
    CREATE INDEX IF NOT EXISTS reports_priority_idx ON reports(priority);
    CREATE INDEX IF NOT EXISTS reports_category_idx ON reports(category);
    CREATE INDEX IF NOT EXISTS report_history_report_time_idx
      ON report_history(report_id, timestamp);
    CREATE INDEX IF NOT EXISTS sync_logs_report_idx ON sync_logs(report_id);
  `);
}

module.exports = { initializeDatabase };

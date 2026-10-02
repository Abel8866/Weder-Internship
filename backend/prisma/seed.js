const { newId, nowIso } = require('../src/utils/ids');
const db = require('../src/database/connection');
const { initializeDatabase } = require('../src/database/migrations');

initializeDatabase();

const samples = [
  ['water_pump', 'Broken water pump leaking at the north access point', 'high', 'draft', 'manual'],
  ['road_blockage', 'Fallen tree blocks the east service road', 'critical', 'submitted', 'gps'],
  ['water_pump', 'Pump motor overheats after five minutes of operation', 'high', 'assigned', 'gps'],
  ['road_blockage', 'Mudslide reduced the passable lane to one side', 'medium', 'in_progress', 'gps'],
  ['water_pump', 'Replacement pump installed and pressure tested', 'medium', 'resolved', 'gps'],
  ['road_blockage', 'Duplicate report: blockage already cleared by local crew', 'low', 'rejected', 'manual']
];

const insertReport = db.prepare(`
  INSERT INTO reports
    (id, category, description, location, priority, status, created_at, updated_at, client_synced_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertHistory = db.prepare(`
  INSERT INTO report_history
    (id, report_id, previous_status, new_status, actor_role, note, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const seed = db.transaction(() => {
  for (const [category, description, priority, status, source] of samples) {
    const id = newId();
    const timestamp = nowIso();
    const location = JSON.stringify({
      latitude: 51.48 + Math.random() / 100,
      longitude: -0.12 - Math.random() / 100,
      accuracy: source === 'gps' ? 8 : undefined,
      landmark: source === 'manual' ? 'South service compound' : undefined,
      source
    });
    insertReport.run(id, category, description, location, priority, status, timestamp, timestamp, timestamp);
    insertHistory.run(
      newId(),
      id,
      null,
      status,
      status === 'draft' ? 'field_worker' : 'coordinator',
      status === 'rejected' ? 'Duplicate of an existing road blockage report' : 'Seeded assessment sample',
      timestamp
    );
  }
});

seed();
console.log(`Seeded ${samples.length} realistic reports across all workflow statuses.`);

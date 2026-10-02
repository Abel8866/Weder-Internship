/**
 * Testing strategy and prioritization:
 * This suite prioritizes the highest-risk business boundaries in the API rather
 * than implementation details: the FSM prevents invalid operational states,
 * idempotent sync prevents duplicate field reports during retries, and request
 * validation prevents malformed data from reaching SQLite. Tests use Supertest
 * against the real Express app and a disposable SQLite database, then verify
 * persisted row counts and audit history directly so HTTP success cannot hide a
 * data-integrity regression.
 */

const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');

const testDatabase = path.join(__dirname, 'api-integration.sqlite');
process.env.NODE_ENV = 'test';
process.env.DATABASE_FILE = testDatabase;

for (const suffix of ['', '-shm', '-wal']) {
  const file = `${testDatabase}${suffix}`;
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

const { initializeDatabase } = require('../src/database/migrations');
const db = require('../src/database/connection');

initializeDatabase();
const app = require('../src/app');

const validLocation = {
  latitude: 51.501,
  longitude: -0.141,
  accuracy: 12,
  source: 'gps'
};

function reportPayload(overrides = {}) {
  return {
    id: '0f2b5b62-3b44-4c74-9b0e-3cc6b2fdb1cb',
    category: 'water_pump',
    description: 'Pump is leaking at the north access point',
    location: validLocation,
    priority: 'high',
    status: 'submitted',
    reported_at: '2026-10-02T10:42:00Z',
    ...overrides
  };
}

async function syncReport(payload, idempotencyKey) {
  return request(app)
    .post('/api/reports/sync')
    .set('Idempotency-Key', idempotencyKey)
    .send(payload);
}

beforeEach(() => {
  db.exec('DELETE FROM sync_logs; DELETE FROM report_history; DELETE FROM reports;');
});

afterAll(() => {
  db.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${testDatabase}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

describe('report workflow transitions', () => {
  test('allows Draft -> Submitted', async () => {
    const id = 'e0c4e6f4-2c7f-4b36-bf0f-4cb3ae2c431a';
    const createResponse = await syncReport(
      reportPayload({ id, status: 'draft' }),
      'fsm-create-draft'
    );
    expect(createResponse.status).toBe(200);

    const response = await request(app)
      .patch(`/api/reports/${id}/status`)
      .send({ newStatus: 'submitted', expectedStatus: 'draft' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('submitted');

    const history = await request(app).get(`/api/reports/${id}/history`);
    expect(history.status).toBe(200);
    expect(history.body.pagination.total).toBe(2);
    expect(history.body.events.map((event) => event.note)).toEqual([
      'Report Created',
      null
    ]);
  });

  test('rejects Draft -> Resolved with a structured 400 error', async () => {
    const id = 'f5e449a9-1748-47d0-b4dd-82f2f265f14a';
    await syncReport(reportPayload({ id, status: 'draft' }), 'fsm-invalid-draft');

    const response = await request(app)
      .patch(`/api/reports/${id}/status`)
      .send({ newStatus: 'resolved', expectedStatus: 'draft' });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.objectContaining({
      code: 'INVALID_TRANSITION',
      currentStatus: 'draft',
      requestedStatus: 'resolved',
      allowedTransitions: ['submitted']
    }));

    const persisted = db.prepare('SELECT status FROM reports WHERE id = ?').get(id);
    expect(persisted.status).toBe('draft');
  });
});

describe('report synchronization idempotency', () => {
  test('accepts the exact same payload twice but persists one report', async () => {
    const payload = reportPayload({
      id: 'b7c9f31a-6db0-4f2f-bd84-b2b6f4457f5c'
    });

    const first = await syncReport(payload, 'sync-idempotency-001');
    const second = await syncReport(payload, 'sync-idempotency-001');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.results[0].outcome).toBe('synced');
    expect(second.body.results[0].outcome).toBe('synced');
    expect(db.prepare('SELECT COUNT(*) AS count FROM reports').get().count).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS count FROM report_history').get().count).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS count FROM sync_logs').get().count).toBe(1);
  });
});

describe('request validation', () => {
  test.each([
    ['empty description', { description: '' }],
    ['invalid priority', { priority: 'urgent' }]
  ])('rejects %s before database insertion', async (_caseName, overrides) => {
    const response = await syncReport(
      reportPayload({
        id: 'd8f02e3a-18af-4fdd-b9bf-5dcf86e42cb3',
        ...overrides
      }),
      `validation-${_caseName.replace(/\s+/g, '-')}`
    );

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(db.prepare('SELECT COUNT(*) AS count FROM reports').get().count).toBe(0);
  });
});

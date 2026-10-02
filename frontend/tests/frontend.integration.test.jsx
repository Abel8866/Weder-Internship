/**
 * Testing strategy: prioritize the offline data-loss boundary and the two
 * highest-value user journeys. These integration tests render the real React
 * UI, use a real Dexie schema backed by fake IndexedDB, and mock only network
 * responses. This proves that worker input reaches the pending outbox, that a
 * coordinator action emits the correct API contract, and that a successful
 * sync changes durable state from pending to synced.
 */
import Dexie from 'dexie';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { App } from '../src/main';
import { OfflineSyncService } from '../src/offlineSyncService';

function createTestDatabase(name) {
  const database = new Dexie(name);
  database.version(1).stores({
    local_reports: 'id, category, priority, status, reported_at, sync_status, last_sync_attempt, retry_count'
  });
  return database;
}

function createService(database, overrides = {}) {
  return new OfflineSyncService({
    database: database.local_reports,
    fetchImpl: globalThis.fetch,
    apiBaseUrl: 'http://api.test',
    ...overrides
  });
}

function reportPayload(overrides = {}) {
  return {
    category: 'water_pump',
    description: 'Pump leaking beside the north access point',
    location: { latitude: 51.501, longitude: -0.141, source: 'gps' },
    priority: 'high',
    status: 'submitted',
    reported_at: '2026-10-02T10:42:00.000Z',
    ...overrides
  };
}

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
});

test('creates an issue offline, persists it in Dexie, and renders Pending Sync', async () => {
  const database = createTestDatabase(`offline-ui-${crypto.randomUUID()}`);
  const service = createService(database);
  render(<App syncService={service} />);

  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Pump leaking beside the north access point' }
  });
  fireEvent.change(screen.getByPlaceholderText('Manual landmark or access instructions'), {
    target: { value: 'North access point' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save issue locally' }));

  expect(await screen.findByText('Saved on this device. It will sync automatically.')).toBeInTheDocument();
  expect(await screen.findByText('Pending Sync')).toBeInTheDocument();

  const stored = await database.local_reports.toArray();
  expect(stored).toHaveLength(1);
  expect(stored[0]).toEqual(expect.objectContaining({
    description: 'Pump leaking beside the north access point',
    sync_status: 'pending',
    retry_count: 0
  }));

  service.destroy();
  await database.delete();
});

test('Coordinator transition calls PATCH with the selected valid state', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  const database = createTestDatabase(`coordinator-ui-${crypto.randomUUID()}`);
  const service = createService(database);
  const id = 'b7c9f31a-6db0-4f2f-bd84-b2b6f4457f5c';
  globalThis.fetch
    .mockResolvedValueOnce(jsonResponse({
      data: [{
        id,
        category: 'water_pump',
        description: 'Pump requires inspection',
        location: { latitude: 51.5, longitude: -0.14, source: 'gps' },
        priority: 'high',
        status: 'submitted',
        createdAt: '2026-10-02T10:42:00Z',
        updatedAt: '2026-10-02T10:42:00Z'
      }]
    }))
    .mockResolvedValueOnce(jsonResponse({
      data: { id, status: 'assigned' }
    }))
    .mockResolvedValueOnce(jsonResponse({
      data: [{
        id,
        category: 'water_pump',
        description: 'Pump requires inspection',
        location: { latitude: 51.5, longitude: -0.14, source: 'gps' },
        priority: 'high',
        status: 'assigned',
        createdAt: '2026-10-02T10:42:00Z',
        updatedAt: '2026-10-02T10:42:00Z'
      }]
    }))
    .mockResolvedValueOnce(jsonResponse({
      events: []
    }));

  render(<App syncService={service} />);
  fireEvent.click(screen.getByRole('button', { name: 'Coordinator' }));
  await screen.findByText('Pump requires inspection', { selector: 'span' });
  fireEvent.change(screen.getByLabelText('Transition status'), { target: { value: 'assigned' } });
  fireEvent.change(screen.getByPlaceholderText('Assignee (required)'), { target: { value: 'crew-7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
    `http://localhost:3000/api/reports/${id}/status`,
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        newStatus: 'assigned',
        expectedStatus: 'submitted',
        reason: undefined,
        assignee: 'crew-7'
      })
    })
  ));

  service.destroy();
  await database.delete();
});

test('changes a pending report to Synced after a successful mock API response', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  const database = createTestDatabase(`sync-ui-${crypto.randomUUID()}`);
  globalThis.fetch.mockResolvedValue(jsonResponse({
    results: [{ outcome: 'synced', status: 'submitted' }]
  }));
  const service = createService(database);
  const saved = await service.saveReportLocally(reportPayload());
  render(<App syncService={service} />);

  expect(await screen.findByText('Pending Sync')).toBeInTheDocument();
  service.isOnline = true;
  await act(async () => {
    await service.triggerSync();
  });

  expect(await screen.findByText('Synced')).toBeInTheDocument();
  const stored = await database.local_reports.get(saved.id);
  expect(stored.sync_status).toBe('synced');
  expect(globalThis.fetch).toHaveBeenCalledWith(
    'http://api.test/api/reports/sync',
    expect.objectContaining({ method: 'POST' })
  );

  service.destroy();
  await database.delete();
});

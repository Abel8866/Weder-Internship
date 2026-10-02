import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useOfflineSync } from './useOfflineSync';
import './styles.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CATEGORIES = [
  { value: 'water_pump', label: 'Water pump' },
  { value: 'road_blockage', label: 'Road blockage' },
  { value: 'power_failure', label: 'Power failure' },
  { value: 'structural_damage', label: 'Structural damage' },
  { value: 'other', label: 'Other infrastructure' }
];
const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' }
];
const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected'
};
const ALLOWED_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['assigned', 'rejected'],
  assigned: ['in_progress', 'rejected'],
  in_progress: ['resolved'],
  resolved: [],
  rejected: []
};

function formatDate(value) {
  if (!value) return 'Not yet attempted';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function categoryLabel(value) {
  return CATEGORIES.find((category) => category.value === value)?.label || value.replaceAll('_', ' ');
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message || `Request failed with HTTP ${response.status}`);
    error.status = response.status;
    error.details = body?.error;
    throw error;
  }
  return body;
}

function StatusBadge({ status, syncStatus }) {
  const value = syncStatus || status;
  const labels = {
    pending: 'Pending Sync',
    synced: 'Synced',
    failed: 'Failed',
    ...STATUS_LABELS
  };
  return <span className={`badge badge-${value}`}>{labels[value] || value}</span>;
}

function ConnectivityBanner({ isOnline, isSyncing, syncError, onSync }) {
  const state = isSyncing ? 'syncing' : syncError ? 'issues' : isOnline ? 'online' : 'offline';
  const labels = {
    online: ['Online', 'Connected and ready to sync'],
    offline: ['Offline', 'Reports are saved on this device'],
    syncing: ['Syncing', 'Sending saved reports to the server'],
    issues: ['Sync Issues', syncError?.message || 'A synchronization attempt failed']
  };
  return (
    <div className={`connectivity-banner banner-${state}`} role="status" aria-live="polite">
      <div className="banner-copy">
        <span className={`status-dot dot-${state}`} aria-hidden="true" />
        <div>
          <strong>{labels[state][0]}</strong>
          <span>{labels[state][1]}</span>
        </div>
      </div>
      <button className="button button-banner" type="button" onClick={onSync} disabled={!isOnline || isSyncing}>
        {isSyncing ? 'Syncing…' : 'Sync Now'}
      </button>
    </div>
  );
}

function RoleSwitcher({ role, setRole }) {
  return (
    <div className="role-switcher" role="group" aria-label="Choose workspace">
      <button className={role === 'worker' ? 'role-active' : ''} type="button" onClick={() => setRole('worker')}>
        Field Worker
      </button>
      <button className={role === 'coordinator' ? 'role-active' : ''} type="button" onClick={() => setRole('coordinator')}>
        Coordinator
      </button>
    </div>
  );
}

function ReportForm({ onSave }) {
  const [form, setForm] = useState({
    category: 'water_pump',
    priority: 'medium',
    description: '',
    location: { latitude: null, longitude: null, source: 'manual', landmark: '' }
  });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const detectGps = () => {
    setForm((current) => ({
      ...current,
      location: {
        latitude: 51.501,
        longitude: -0.141,
        accuracy: 25,
        source: 'gps',
        landmark: 'GPS location captured'
      }
    }));
    setMessage('GPS location captured (demo coordinates).');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.description.trim()) {
      setMessage('Add a description before saving this issue.');
      return;
    }
    const hasCoordinates = Number.isFinite(form.location.latitude) && Number.isFinite(form.location.longitude);
    if (!hasCoordinates && !form.location.landmark.trim()) {
      setMessage('Detect GPS or enter a manual landmark.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await onSave({
        ...form,
        description: form.description.trim(),
        location: {
          ...form.location,
          latitude: form.location.latitude ?? 0,
          longitude: form.location.longitude ?? 0,
          source: hasCoordinates ? form.location.source : 'manual'
        },
        reported_at: new Date().toISOString()
      });
      setForm({
        category: 'water_pump',
        priority: 'medium',
        description: '',
        location: { latitude: null, longitude: null, source: 'manual', landmark: '' }
      });
      setMessage('Saved on this device. It will sync automatically.');
    } catch (error) {
      setMessage(`Could not save locally: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel form-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Field capture</p>
          <h2>Report an issue</h2>
        </div>
        <span className="save-hint">Local-first</span>
      </div>
      <form onSubmit={submit}>
        <label>
          Category
          <select value={form.category} onChange={(event) => update('category', event.target.value)}>
            {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Priority</legend>
          <div className="priority-grid">
            {PRIORITIES.map((priority) => (
              <label className={`priority-option priority-${priority.value}`} key={priority.value}>
                <input
                  type="radio"
                  name="priority"
                  value={priority.value}
                  checked={form.priority === priority.value}
                  onChange={(event) => update('priority', event.target.value)}
                />
                <span>{priority.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Description
          <textarea
            rows="5"
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder="What did you observe? Include landmarks and immediate risks."
          />
        </label>
        <div className="location-heading">
          <label htmlFor="landmark">Location</label>
          <button className="button button-secondary button-small" type="button" onClick={detectGps}>Detect GPS</button>
        </div>
        <div className="location-card">
          <div className="location-status">
            <span className={`location-icon ${form.location.source === 'gps' ? 'location-found' : ''}`}>⌖</span>
            <div>
              <strong>{form.location.source === 'gps' ? 'GPS captured' : 'Manual fallback'}</strong>
              <span>
                {form.location.latitude ? `${form.location.latitude.toFixed(3)}, ${form.location.longitude.toFixed(3)}` : 'No coordinates yet'}
              </span>
            </div>
          </div>
          <input
            id="landmark"
            value={form.location.landmark}
            onChange={(event) => setForm((current) => ({
              ...current,
              location: { ...current.location, landmark: event.target.value, source: 'manual' }
            }))}
            placeholder="Manual landmark or access instructions"
          />
        </div>
        {message && <p className="form-message" role="alert">{message}</p>}
        <button className="button button-primary button-submit" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save issue locally'}
        </button>
      </form>
    </section>
  );
}

function QueueSection({ reports, onRetry }) {
  return (
    <section className="panel queue-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Outbox</p>
          <h2>Local queue</h2>
        </div>
        <span className="queue-count">{reports.length} saved</span>
      </div>
      {reports.length === 0 ? (
        <div className="empty-state"><span className="empty-icon">✓</span><strong>No local issues yet</strong><span>Saved reports will appear here.</span></div>
      ) : (
        <div className="queue-list">
          {reports.map((report) => (
            <article className="queue-item" key={report.id}>
              <div className="queue-item-main">
                <div className="item-title-row"><strong>{categoryLabel(report.category)}</strong><StatusBadge syncStatus={report.sync_status} /></div>
                <p>{report.description}</p>
                <small>{formatDate(report.reported_at)} · {report.retry_count || 0} attempt(s)</small>
              </div>
              {report.sync_status === 'failed' && <button className="button button-secondary button-small" type="button" onClick={onRetry}>Retry</button>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function WorkerView({ reports, saveReportLocally, triggerSync }) {
  const [queueFilter, setQueueFilter] = useState('all');
  const visibleReports = queueFilter === 'all' ? reports : reports.filter((report) => report.sync_status === queueFilter);
  return (
    <div className="worker-layout">
      <ReportForm onSave={saveReportLocally} />
      <div>
        <div className="queue-filter" role="group" aria-label="Filter local queue">
          {['all', 'pending', 'failed', 'synced'].map((filter) => (
            <button key={filter} className={queueFilter === filter ? 'filter-active' : ''} type="button" onClick={() => setQueueFilter(filter)}>
              {filter === 'all' ? 'All' : filter === 'pending' ? 'Pending' : filter[0].toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
        <QueueSection reports={visibleReports} onRetry={triggerSync} />
      </div>
    </div>
  );
}

function CoordinatorView() {
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const query = filter === 'all' ? '' : `?status=${filter}`;
      const body = await apiRequest(`/api/reports${query}`);
      setReports(body.data || []);
      setSelectedId((current) => current && body.data.some((report) => report.id === current) ? current : body.data[0]?.id || null);
      setError('');
    } catch (requestError) {
      setError(`Could not load coordinator queue: ${requestError.message}`);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void loadReports(); }, [loadReports]);

  const selected = reports.find((report) => report.id === selectedId);
  return (
    <div className="coordinator-layout">
      <section className="panel coordinator-list">
        <div className="section-heading">
          <div><p className="eyebrow">Operations</p><h2>Submitted issues</h2></div>
          <button className="icon-button" type="button" onClick={loadReports} aria-label="Refresh coordinator queue">↻</button>
        </div>
        <div className="filter-row">
          <label htmlFor="status-filter">Status</label>
          <select id="status-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {error && <p className="form-message" role="alert">{error}</p>}
        {loading ? <div className="loading-state">Loading server queue…</div> : (
          <div className="coordinator-items">
            {reports.map((report) => (
              <button className={`coordinator-item ${selectedId === report.id ? 'item-selected' : ''}`} type="button" key={report.id} onClick={() => setSelectedId(report.id)}>
                <span className="item-title-row"><strong>{categoryLabel(report.category)}</strong><StatusBadge status={report.status} /></span>
                <span>{report.description}</span>
                <small>{report.priority} priority · {formatDate(report.updatedAt)}</small>
              </button>
            ))}
            {!reports.length && <div className="empty-state"><strong>No reports match this filter.</strong></div>}
          </div>
        )}
      </section>
      {selected ? <CoordinatorDetail report={selected} onUpdated={loadReports} /> : (
        <section className="panel detail-empty"><span className="empty-icon">←</span><strong>Select an issue</strong><span>Review details and history here.</span></section>
      )}
    </div>
  );
}

function CoordinatorDetail({ report, onUpdated }) {
  const [history, setHistory] = useState([]);
  const [nextStatus, setNextStatus] = useState('');
  const [reason, setReason] = useState('');
  const [assignee, setAssignee] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const transitions = ALLOWED_TRANSITIONS[report.status] || [];

  const loadHistory = async () => {
    try {
      const body = await apiRequest(`/api/reports/${report.id}/history?pageSize=100`);
      setHistory(body.events || []);
      setShowHistory(true);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const changeStatus = async (event) => {
    event.preventDefault();
    if (!nextStatus) return;
    setSaving(true);
    setMessage('');
    try {
      await apiRequest(`/api/reports/${report.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          newStatus: nextStatus,
          expectedStatus: report.status,
          reason: reason || undefined,
          assignee: assignee || undefined
        })
      });
      setNextStatus('');
      setReason('');
      setAssignee('');
      await onUpdated();
      await loadHistory();
    } catch (error) {
      setMessage(error.details?.message || error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel detail-panel">
      <div className="detail-header">
        <div><p className="eyebrow">Issue detail</p><h2>{categoryLabel(report.category)}</h2><span className="detail-id">{report.id}</span></div>
        <StatusBadge status={report.status} />
      </div>
      <div className="detail-summary"><p>{report.description}</p><div className="meta-grid"><span><small>Priority</small><strong>{report.priority}</strong></span><span><small>Reported</small><strong>{formatDate(report.createdAt)}</strong></span><span><small>Location</small><strong>{report.location?.landmark || `${report.location?.latitude}, ${report.location?.longitude}`}</strong></span></div></div>
      <form className="transition-form" onSubmit={changeStatus}>
        <label htmlFor="next-status">Transition status</label>
        <div className="transition-controls">
          <select id="next-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={!transitions.length}>
            <option value="">{transitions.length ? 'Choose next state' : 'No transitions available'}</option>
            {transitions.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
          {nextStatus === 'assigned' ? (
            <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Assignee (required)" />
          ) : (
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={nextStatus === 'rejected' ? 'Rejection reason (required)' : 'Transition note (optional)'} />
          )}
          <button className="button button-primary" type="submit" disabled={!nextStatus || saving}>{saving ? 'Saving…' : 'Apply'}</button>
        </div>
      </form>
      {message && <p className="form-message" role="alert">{message}</p>}
      <div className="history-section">
        <button className="history-toggle" type="button" onClick={showHistory ? () => setShowHistory(false) : loadHistory}>
          <span>{showHistory ? '⌄' : '›'}</span> Audit history
        </button>
        {showHistory && <div className="timeline">{history.map((event) => <div className="timeline-event" key={event.id}><span className="timeline-dot" /><div><strong>{event.note || `${STATUS_LABELS[event.previousStatus] || 'Created'} → ${STATUS_LABELS[event.newStatus]}`}</strong><span>{event.actorRole.replace('_', ' ')} · {formatDate(event.timestamp)}</span></div></div>)}</div>}
      </div>
    </section>
  );
}

export function App({ syncService = offlineSyncService }) {
  const [role, setRole] = useState('worker');
  const { isOnline, isSyncing, syncError, reports, saveReportLocally, triggerSync } = useOfflineSync(syncService);
  const hasSyncIssue = useMemo(() => syncError || null, [syncError]);
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><span className="brand-mark">+</span><div><strong>Field<span>Track</span></strong><small>Infrastructure issue operations</small></div></div>
        <RoleSwitcher role={role} setRole={setRole} />
      </header>
      <ConnectivityBanner isOnline={isOnline} isSyncing={isSyncing} syncError={hasSyncIssue} onSync={triggerSync} />
      <main className="app-main">
        <div className="page-intro"><div><p className="eyebrow">{role === 'worker' ? 'Field workspace' : 'Coordinator workspace'}</p><h1>{role === 'worker' ? 'Capture what you see.' : 'Keep work moving.'}</h1></div><span className="today">{new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date())}</span></div>
        {role === 'worker' ? <WorkerView reports={reports} saveReportLocally={saveReportLocally} triggerSync={triggerSync} /> : <CoordinatorView />}
      </main>
    </div>
  );
}

if (document.getElementById('root')) {
  createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
}

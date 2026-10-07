import { useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { listAdminAuditEvents } from './api.js';

const emptyFilters = { q: '', source: '', action: '', from: '', to: '' };

function eventLabel(value) {
  return value.replaceAll('_', ' ').replaceAll('.', ' / ');
}

export function AdminAuditLog() {
  const [filters, setFilters] = useState(emptyFilters);
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh(nextFilters = filters, page = 1) {
    setLoading(true);
    setError('');
    try {
      const result = await listAdminAuditEvents(nextFilters, { page, limit: pagination.limit });
      setEvents(result.events);
      setPagination(result.pagination);
      setFilters(nextFilters);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(emptyFilters, 1); }, []);

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    refresh(Object.fromEntries(Object.keys(emptyFilters).map((key) => [key, String(form.get(key) ?? '')])), 1);
  }

  return <section className="surface-section full-section admin-audit-log">
    <div className="section-heading request-list-heading"><div><p className="eyebrow">PLATFORM OPERATIONS</p><h2>Audit log <span className="heading-count">{pagination.total}</span></h2></div>
      <button className="icon-button" aria-label="Refresh audit log" title="Refresh audit log" disabled={loading} onClick={() => refresh(filters, pagination.page)}><RefreshCw size={15} /></button>
    </div>
    <form className="audit-filter-form" onSubmit={submit}>
      <label className="field-label">Search<input className="form-input" name="q" defaultValue={filters.q} placeholder="Organization, actor, action, or details" /></label>
      <label className="field-label">Source<input className="form-input" name="source" defaultValue={filters.source} placeholder="e.g. organization" /></label>
      <label className="field-label">Action<input className="form-input" name="action" defaultValue={filters.action} placeholder="e.g. document.expired" /></label>
      <label className="field-label">From<input className="form-input" name="from" type="date" defaultValue={filters.from} /></label>
      <label className="field-label">To<input className="form-input" name="to" type="date" defaultValue={filters.to} /></label>
      <button className="secondary-button" disabled={loading}><Search size={14} />Search</button>
    </form>
    {error && <div className="auth-error" role="alert">{error}</div>}
    {loading ? <div className="empty-state">Loading audit events...</div> : events.length ? <div className="role-table-wrap"><table className="role-table"><thead><tr><th>WHEN</th><th>ORGANIZATION</th><th>ACTOR</th><th>ACTION</th><th>SOURCE</th><th>DETAILS</th></tr></thead><tbody>
      {events.map((event) => <tr key={`${event.source}:${event.id}`}>
        <td>{new Date(event.createdAt).toLocaleString()}</td>
        <td>{event.organizationName ?? 'Platform'}<small>{event.organizationId ?? ''}</small></td>
        <td>{event.actorName ?? 'System'}</td>
        <td>{eventLabel(event.action)}{event.targetName && <small>Target: {event.targetName}</small>}</td>
        <td>{eventLabel(event.source)}</td>
        <td><details className="audit-event-details"><summary>View</summary><pre>{JSON.stringify(event.details, null, 2)}</pre></details></td>
      </tr>)}
    </tbody></table></div> : <div className="empty-state">No audit events match these filters.</div>}
    <div className="supplier-pagination"><span>{pagination.total ? `Page ${pagination.page} / ${Math.ceil(pagination.total / pagination.limit)} · ${pagination.total} events` : '0 events'}</span><div>
      <button className="secondary-button" disabled={loading || pagination.page <= 1} onClick={() => refresh(filters, pagination.page - 1)}>Previous</button>
      <button className="secondary-button" disabled={loading || !pagination.hasMore} onClick={() => refresh(filters, pagination.page + 1)}>Next</button>
    </div></div>
  </section>;
}
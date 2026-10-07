import { useEffect, useState } from 'react';
import { Check, Flag, RefreshCw, ShieldCheck } from 'lucide-react';
import { decideBookingDispute, getAdminDisputes } from './api.js';

const statuses = ['open', 'in_review', 'resolved', 'rejected', 'all'];

export function AdminDisputes() {
  const [status, setStatus] = useState('open');
  const [disputes, setDisputes] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setDisputes((await getAdminDisputes(status)).disputes);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [status]);

  async function decide(dispute, nextStatus) {
    setBusyId(dispute.id);
    setError('');
    try {
      await decideBookingDispute(dispute.id, nextStatus, notes[dispute.id] ?? '');
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <>
      <div className="page-heading admin-heading outbox-heading"><div><p className="eyebrow">TRUST AND SAFETY</p><h2>Booking disputes</h2><p className="page-subtitle">Review evidence and record each decision in the case timeline.</p></div><button className="secondary-button" onClick={refresh} disabled={loading}><RefreshCw size={15} />Refresh</button></div>
      <section className="surface-section admin-queue admin-disputes">
        <label className="field-label">Case status<select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}</select></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {loading ? <div className="empty-state">Loading disputes...</div> : disputes.length ? disputes.map((dispute) => (
          <article className="dispute-admin-entry" key={dispute.id}>
            <div className="verification-title"><span className="role-option-icon"><Flag size={17} /></span><div><h3>{dispute.requestCode} / {dispute.category}</h3><span>{dispute.agencyName} and {dispute.sellerName}</span></div><span className={`status-pill ${dispute.status === 'resolved' ? 'open' : dispute.status === 'rejected' ? 'cancelled' : 'draft'}`}><i />{dispute.status.replace('_', ' ')}</span></div>
            <p>{dispute.summary}</p>
            <ol className="booking-change-list">{dispute.timeline.map((event) => <li key={event.id}><strong>{event.type.replaceAll('_', ' ')}</strong><p>{event.message}</p><time>{new Date(event.createdAt).toLocaleString()}</time></li>)}</ol>
            {dispute.resolutionNote && <p className="privacy-note"><ShieldCheck size={15} />Decision: {dispute.resolutionNote}</p>}
            {['open', 'in_review'].includes(dispute.status) && <>
              <label className="field-label">Review or resolution note<textarea className="form-input" value={notes[dispute.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [dispute.id]: event.target.value }))} minLength="5" maxLength="1000" required /></label>
              <div className="verification-actions">
                {dispute.status === 'open' && <button className="secondary-button" disabled={busyId === dispute.id || (notes[dispute.id]?.trim().length ?? 0) < 5} onClick={() => decide(dispute, 'in_review')}>Start review</button>}
                <button className="primary-button" disabled={busyId === dispute.id || (notes[dispute.id]?.trim().length ?? 0) < 5} onClick={() => decide(dispute, 'resolved')}><Check size={15} />Resolve</button>
                <button className="secondary-button reject-button" disabled={busyId === dispute.id || (notes[dispute.id]?.trim().length ?? 0) < 5} onClick={() => decide(dispute, 'rejected')}>Reject</button>
              </div>
            </>}
          </article>
        )) : <div className="empty-state"><ShieldCheck size={22} /><strong>No cases in this queue</strong><span>Booking disputes will appear here for review.</span></div>}
      </section>
    </>
  );
}

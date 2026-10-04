import { useEffect, useState } from 'react';
import { BadgeCheck, Building2, ExternalLink, Globe2, Hotel, LogOut, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { createDocumentDownloadUrl, decideSellerVerification, getNotificationOutbox, listPendingSellerProfiles, logoutAccount, retryNotificationOutbox } from './api.js';
import { MfaSecurityPanel } from './MfaSecurity.jsx';
import { AdminModeration } from './AdminModeration.jsx';
import { AdminDestinations, AdminLegalDocuments, AdminOperations, AdminSettings } from './AdminPlatform.jsx';
import { documentStateClass, formatBytes } from './SellerDocuments.jsx';
import { labelFor, useReferenceData } from './referenceData.js';

function AdminWorkspace({ account }) {
  const { data: reference } = useReferenceData();
  const [openingDocumentId, setOpeningDocumentId] = useState('');
  const [sellers, setSellers] = useState([]);
  const [reasons, setReasons] = useState({});
  const [evidenceReviewed, setEvidenceReviewed] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState('');
  const [outbox, setOutbox] = useState({ entries: [], summary: [] });
  const [outboxLoading, setOutboxLoading] = useState(true);
  const [retryingOutboxId, setRetryingOutboxId] = useState('');

  async function refreshQueue() {
    setLoading(true);
    setError('');
    try {
      const result = await listPendingSellerProfiles();
      setSellers(result.sellers);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshOutbox() {
    setOutboxLoading(true);
    try {
      setOutbox(await getNotificationOutbox());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOutboxLoading(false);
    }
  }

  useEffect(() => { refreshQueue(); refreshOutbox(); }, []);

  async function decide(seller, decision) {
    const reason = reasons[seller.organizationId]?.trim() ?? '';
    if (reason.length < 5 || !evidenceReviewed[seller.organizationId]) {
      setError('Confirm evidence review and add a decision reason before continuing.');
      return;
    }
    setProcessingId(seller.organizationId);
    setError('');
    try {
      await decideSellerVerification(seller.organizationId, decision, reason);
      setSellers((current) => current.filter((item) => item.organizationId !== seller.organizationId));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessingId('');
    }
  }

  async function openDocument(document) {
    // Open the tab synchronously so popup blockers allow it, then point it at the short-lived signed link.
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    setOpeningDocumentId(document.id);
    setError('');
    try {
      const { url } = await createDocumentDownloadUrl(document.id);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (requestError) {
      tab?.close();
      setError(requestError.message);
    } finally {
      setOpeningDocumentId('');
    }
  }

  async function requeue(entry) {
    setRetryingOutboxId(String(entry.id));
    setError('');
    try {
      await retryNotificationOutbox(entry.id);
      await refreshOutbox();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRetryingOutboxId('');
    }
  }

  async function signOut() {
    try {
      await logoutAccount();
      window.location.assign('/login');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <a className="auth-brand" href="/workspace/admin/verification"><span className="brand-mark"><Globe2 size={20} /></span><span><strong>LEAD EXCHANGE</strong><small>Platform operations</small></span></a>
        <div className="admin-user"><span><strong>{account.user.fullName}</strong><small>Platform administrator</small></span><button className="icon-button" aria-label="Sign out" onClick={signOut}><LogOut size={16} /></button></div>
      </header>
      <div className="admin-content">
        <div className="page-heading admin-heading"><div><p className="eyebrow">TRUST AND SAFETY</p><h1>Seller verification</h1><p className="page-subtitle">Review business claims before marketplace access is enabled.</p></div><span className="admin-queue-count"><ShieldCheck size={16} />{sellers.length} pending</span></div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <section className="surface-section admin-queue">
          {loading ? <div className="empty-state">Loading verification queue...</div> : sellers.length ? sellers.map((seller) => {
            const Icon = seller.businessType === 'hotelier' ? Hotel : Building2;
            return <article className="verification-row" key={seller.organizationId}>
              <div className="verification-main"><div className="verification-title"><span className="role-option-icon"><Icon size={17} /></span><div><h2>{seller.organizationName}</h2><span>{seller.businessType} / {seller.countryCode}</span></div><span className="status-pill draft"><i />Pending</span></div>
                <div className="verification-facts"><span><Globe2 size={14} />{seller.businessType === 'dmc' ? seller.coverageDestinations.join(', ') : seller.propertyCity}</span><span>Submitted {new Date(seller.submittedAt).toLocaleDateString()}</span></div>
                <ul className="verification-documents">{seller.documents.requirements.map((item) => <li key={item.type}>
                  <strong>{item.label}{item.required ? '' : ' (optional)'}</strong>
                  <span className={`status-pill ${documentStateClass(item.document)}`}><i />{item.document ? labelFor(reference?.documentScanStatuses, item.document.scanStatus) : 'Missing'}</span>
                  {item.document && <span>{item.document.filename} / {formatBytes(item.document.sizeBytes)}</span>}
                  {item.document?.scanStatus === 'clean' && !item.document.removedAt && <button className="text-button" disabled={openingDocumentId === item.document.id} onClick={() => openDocument(item.document)}><ExternalLink size={13} />Open</button>}
                </li>)}</ul>
                <label className="evidence-confirm"><input type="checkbox" checked={Boolean(evidenceReviewed[seller.organizationId])} onChange={(event) => setEvidenceReviewed((current) => ({ ...current, [seller.organizationId]: event.target.checked }))} />I reviewed the seller's verification evidence.</label>
                <label className="field-label">Decision reason<textarea value={reasons[seller.organizationId] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [seller.organizationId]: event.target.value }))} minLength="5" maxLength="500" placeholder="Record the review outcome" /></label>
              </div>
              <div className="verification-actions"><button className="secondary-button reject-button" disabled={processingId === seller.organizationId || !evidenceReviewed[seller.organizationId] || (reasons[seller.organizationId]?.trim().length ?? 0) < 5} onClick={() => decide(seller, 'rejected')}>Reject</button><button className="primary-button" disabled={processingId === seller.organizationId || !evidenceReviewed[seller.organizationId] || (reasons[seller.organizationId]?.trim().length ?? 0) < 5 || !seller.documents.complete} title={seller.documents.complete ? undefined : 'Every required document must be uploaded and scanned clean before approval.'} onClick={() => decide(seller, 'approved')}><BadgeCheck size={15} />Approve</button></div>
            </article>;
          }) : <div className="empty-state"><ShieldCheck size={24} /><strong>Queue clear</strong><span>There are no seller profiles awaiting review.</span></div>}
        </section>
        <p className="admin-policy-note">Approval is audited and enables request matching and offer submission for that seller organization.</p>
        <AdminModeration />
        <AdminSettings />
        <AdminOperations />
        <AdminDestinations />
        <AdminLegalDocuments />
        <div className="page-heading admin-heading outbox-heading"><div><p className="eyebrow">DELIVERY OPERATIONS</p><h2>Notification outbox</h2><p className="page-subtitle">Durable delivery attempts and retry state.</p></div><button className="secondary-button" onClick={refreshOutbox} disabled={outboxLoading}><RefreshCw size={15} />Refresh</button></div>
        <div className="outbox-summary">{outbox.summary.map((item) => <span key={item.status}><strong>{item.count}</strong> {item.status.replace('_', ' ')}</span>)}</div>
        <section className="surface-section admin-queue notification-outbox-queue">
          {outboxLoading ? <div className="empty-state">Loading notification queue...</div> : outbox.entries.length ? outbox.entries.map((entry) => (
            <article className="outbox-entry" key={entry.id}>
              <div className="outbox-entry-main"><strong>{entry.title}</strong><span>{entry.organizationName} / {entry.eventType.replaceAll('_', ' ')}</span><small>Created {new Date(entry.createdAt).toLocaleString()}</small></div>
              <div className="outbox-entry-state"><span className={`status-pill ${entry.status === 'delivered' ? 'open' : 'draft'}`}><i />{entry.status.replace('_', ' ')}</span><small>{entry.attempts} attempts{entry.lastErrorCode ? ` / ${entry.lastErrorCode}` : ''}</small></div>
              {['blocked_config', 'dead_letter'].includes(entry.status) && <button className="secondary-button" disabled={retryingOutboxId === String(entry.id)} onClick={() => requeue(entry)}><RefreshCw size={14} />{retryingOutboxId === String(entry.id) ? 'Queueing...' : 'Queue retry'}</button>}
            </article>
          )) : <div className="empty-state"><Mail size={23} /><strong>No queued notifications</strong><span>New marketplace events appear here for delivery tracking.</span></div>}
        </section>
        <p className="admin-policy-note">External email remains blocked until a real provider is configured. Queueing a retry does not claim that a message was sent.</p>
        <div className="page-heading admin-heading outbox-heading"><div><p className="eyebrow">ACCOUNT SECURITY</p><h2>Administrator MFA</h2></div></div>
        <section className="surface-section admin-queue admin-mfa-panel"><MfaSecurityPanel account={account} /></section>
      </div>
    </main>
  );
}

export default AdminWorkspace;